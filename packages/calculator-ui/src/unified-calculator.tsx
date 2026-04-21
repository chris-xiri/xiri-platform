'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    BUILDING_TYPES,
    CLEANING_TASKS,
    DEFAULT_INPUTS,
    FREQUENCIES,
    ROOM_TYPES,
    STATES,
    TASK_CATEGORIES,
    calculate,
    getDefaultRooms,
    getStateDefaults,
    type Frequency,
    type RoomScope,
} from '@xiri-facility-solutions/shared';

export type UnifiedCalculatorMode = 'client' | 'contractor';

const SERVED_COUNTIES = ['nassau', 'suffolk', 'queens'] as const;
type ServedCounty = (typeof SERVED_COUNTIES)[number] | 'other' | 'unknown';
const FEATURED_BUILDING_TYPES = 6;
const LEAD_LOCKED_OVERHEAD_PERCENT = 12;
const LEAD_LOCKED_PROFIT_PERCENT = 25;

function isServedArea(state: string, county: ServedCounty): boolean {
    return state === 'NY' && SERVED_COUNTIES.includes(county as (typeof SERVED_COUNTIES)[number]);
}

function buildXiriOsUrl(params: {
    state: string;
    buildingTypeId: string;
    sqft: number;
    frequency: Frequency;
    estimate: number;
}) {
    const q = new URLSearchParams({
        source: 'xiri_ai_calculator',
        utm_source: 'xiri_ai',
        utm_medium: 'calculator',
        utm_campaign: 'contractor_monetization',
        state: params.state,
        buildingTypeId: params.buildingTypeId,
        sqft: String(params.sqft || 0),
        frequency: params.frequency,
        estimate: String(Math.round(params.estimate || 0)),
    });
    return `https://os.xiri.ai/app/login?mode=signup&${q.toString()}`;
}

function buildVendorOnboardingUrl(county: ServedCounty) {
    const q = new URLSearchParams({
        source: 'calculator_contractor_managed',
        trade: 'janitorial',
        zone: county === 'unknown' ? 'nassau' : county,
        state: 'NY',
    });
    return `/onboarding/start?${q.toString()}`;
}

interface WizardParsedValues {
    buildingTypeId?: string;
    stateCode?: string;
    county?: ServedCounty;
    sqft?: number;
    frequency?: Frequency;
    productionRate?: number;
    replaceRooms?: boolean;
    rooms?: Array<{
        roomTypeId?: string;
        sqft?: number;
        tasks?: string[];
    }>;
    taskMinutesPer1kOverrides?: Record<string, number>;
}

const BUILDING_TYPE_ALIASES: Array<{ id: string; patterns: RegExp[] }> = [
    { id: 'medical', patterns: [/\bmedical\b/i, /\bclinic\b/i, /\burgent\s*care\b/i, /\bdental\b/i, /\bhealth\s*center\b/i] },
    { id: 'office', patterns: [/\boffice\b/i, /\bcorporate\b/i, /\bheadquarters\b/i] },
    { id: 'school', patterns: [/\bschool\b/i, /\buniversity\b/i, /\bcollege\b/i, /\bcampus\b/i] },
    { id: 'retail', patterns: [/\bretail\b/i, /\bstorefront\b/i, /\bstore\b/i, /\bshop\b/i] },
    { id: 'restaurant', patterns: [/\brestaurant\b/i, /\bfood\s*service\b/i, /\bcafe\b/i, /\bkitchen\b/i] },
    { id: 'warehouse', patterns: [/\bwarehouse\b/i, /\bindustrial\b/i, /\bdistribution\b/i] },
    { id: 'church', patterns: [/\bchurch\b/i, /\bworship\b/i, /\btemple\b/i, /\bsynagogue\b/i, /\bmosque\b/i] },
    { id: 'gym', patterns: [/\bgym\b/i, /\bfitness\b/i, /\bhealth\s*club\b/i] },
    { id: 'bank', patterns: [/\bbank\b/i, /\bfinancial\b/i, /\bcredit\s*union\b/i] },
    { id: 'daycare', patterns: [/\bdaycare\b/i, /\bday\s*care\b/i, /\bchild\s*care\b/i, /\bchildcare\b/i, /\bpreschool\b/i] },
    { id: 'hotel', patterns: [/\bhotel\b/i, /\bhospitality\b/i, /\bmotel\b/i] },
    { id: 'auto-dealer', patterns: [/\bauto\s*dealership\b/i, /\bdealership\b/i, /\bcar\s*dealer\b/i] },
    { id: 'salon', patterns: [/\bsalon\b/i, /\bspa\b/i, /\bbarber\b/i, /\bbeauty\b/i] },
    { id: 'movie-theater', patterns: [/\bmovie\s*theater\b/i, /\bcinema\b/i, /\btheater\b/i] },
    { id: 'residential', patterns: [/\bresidential\b/i, /\bhome\b/i, /\bhouse\b/i, /\bapartment\b/i] },
];

function parseWizardPrompt(prompt: string): WizardParsedValues {
    const raw = prompt.trim();
    const text = raw.toLowerCase();
    const out: WizardParsedValues = {};

    // Building type (explicit alias map first for deterministic matching)
    for (const rule of BUILDING_TYPE_ALIASES) {
        if (rule.patterns.some((p) => p.test(text))) {
            out.buildingTypeId = rule.id;
            break;
        }
    }

    // Fallback to name-based matching when aliases don't hit
    if (!out.buildingTypeId) {
        for (const bt of BUILDING_TYPES) {
            const name = bt.name.toLowerCase();
            const compact = name.replace(/[^a-z0-9]/g, '');
            if (text.includes(name) || text.includes(compact)) {
                out.buildingTypeId = bt.id;
                break;
            }
            const keyWords = name.split(/[\/\s]+/).filter((w) => w.length > 3);
            if (keyWords.some((w) => text.includes(w))) {
                out.buildingTypeId = bt.id;
                break;
            }
        }
    }

    // State: pass 1 (full state name), pass 2 (explicit abbreviation)
    for (const s of STATES) {
        if (text.includes(s.name.toLowerCase())) {
            out.stateCode = s.code;
            break;
        }
    }
    if (!out.stateCode) {
        // Prefer explicit uppercase abbreviations (e.g. "NJ", "NY")
        const upperTokens = raw.match(/\b[A-Z]{2}\b/g) ?? [];
        for (const token of upperTokens) {
            const state = STATES.find((s) => s.code === token);
            if (state) {
                out.stateCode = state.code;
                break;
            }
        }
    }
    if (!out.stateCode) {
        // Allow lowercase abbreviation only when explicitly labeled as state
        const labeledCode =
            text.match(/\bstate\s*[:\-]?\s*([a-z]{2})\b/i)?.[1] ||
            text.match(/\(([a-z]{2})\)/i)?.[1];
        if (labeledCode) {
            const upper = labeledCode.toUpperCase();
            const state = STATES.find((s) => s.code === upper);
            if (state) out.stateCode = state.code;
        }
    }

    // County (NY service-area logic)
    if (text.includes('nassau')) out.county = 'nassau';
    else if (text.includes('suffolk')) out.county = 'suffolk';
    else if (text.includes('queens')) out.county = 'queens';
    else if (text.includes('other')) out.county = 'other';
    if ((out.county === 'nassau' || out.county === 'suffolk' || out.county === 'queens') && !out.stateCode) {
        out.stateCode = 'NY';
    }

    // Square footage
    const sqftMatch =
        text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)\s*(sq\s*ft|sqft|square\s*feet|square\s*foot|sf)\b/i) ||
        text.match(/(\d[\d,]*)\s*(sq\s*ft|sqft|square\s*feet|square\s*foot|sf)\b/i) ||
        text.match(/\b(\d{3,6})\b/);
    if (sqftMatch?.[1]) {
        const parsed = Number(sqftMatch[1].replace(/,/g, '')) * (sqftMatch?.[2] === 'k' ? 1000 : 1);
        if (Number.isFinite(parsed) && parsed >= 100) out.sqft = parsed;
    }

    // Frequency
    if (text.includes('one-time') || text.includes('one time') || text.includes('deep clean')) out.frequency = 'once';
    else {
        const fx = text.match(/\b([1-7])\s*x\b/);
        if (fx?.[1]) out.frequency = fx[1] as Frequency;
        else if (text.includes('daily')) out.frequency = '7';
        else if (text.includes('weekdays')) out.frequency = '5';
        else if (text.includes('weekly')) out.frequency = '1';
    }

    // Production rate override
    const prMatch = text.match(/production\s*rate[^\d]{0,10}(\d[\d,]*)/i) || text.match(/(\d[\d,]*)\s*(sqft\/hr|sqft per hour)/i);
    if (prMatch?.[1]) {
        const parsed = Number(prMatch[1].replace(/,/g, ''));
        if (Number.isFinite(parsed) && parsed > 0) out.productionRate = parsed;
    }

    return out;
}

interface UnifiedCalculatorProps {
    mode?: UnifiedCalculatorMode;
    onAiParsePrompt?: (prompt: string) => Promise<Record<string, unknown> | null>;
}

export function UnifiedCalculator({ mode = 'client', onAiParsePrompt }: UnifiedCalculatorProps) {
    const [buildingTypeId, setBuildingTypeId] = useState(DEFAULT_INPUTS.buildingTypeId);
    const [stateCode, setStateCode] = useState('NY');
    const [county, setCounty] = useState<ServedCounty>('unknown');
    const [sqft, setSqft] = useState(10000);
    const [frequency, setFrequency] = useState<Frequency>('5');
    const [overheadPercent, setOverheadPercent] = useState(LEAD_LOCKED_OVERHEAD_PERCENT);
    const [profitPercent, setProfitPercent] = useState(LEAD_LOCKED_PROFIT_PERCENT);

    const [rooms, setRooms] = useState<RoomScope[]>([]);
    const prevSqftRef = useRef(10000);
    const initializedSqftRef = useRef(false);
    const syncingRoomsFromSqftRef = useRef(false);

    const [showAdvancedProduction, setShowAdvancedProduction] = useState(false);
    const [useProductionOverride, setUseProductionOverride] = useState(false);
    const [productionRateOverride, setProductionRateOverride] = useState<number>(0);
    const [showAdvancedTaskRates, setShowAdvancedTaskRates] = useState(false);
    const [taskRateOverrides, setTaskRateOverrides] = useState<Record<string, number>>({});
    const [wizardPrompt, setWizardPrompt] = useState('');
    const [wizardStatus, setWizardStatus] = useState('');
    const [wizardNudges, setWizardNudges] = useState<string[]>([
        '12,000 sqft medical clinic in Queens, New York cleaned 5x/week.',
        'Replace scope with: lobby 1200 sqft, offices 7000 sqft, restrooms 1200 sqft, hallways 2600 sqft.',
        'Use slower restroom cleaning and faster office dusting based on our crew workflow.',
    ]);
    const [showStickySummary, setShowStickySummary] = useState(false);
    const [taskSearchByRoom, setTaskSearchByRoom] = useState<Record<string, string>>({});
    const [taskCategoryByRoom, setTaskCategoryByRoom] = useState<Record<string, string>>({});
    const [selectedOnlyByRoom, setSelectedOnlyByRoom] = useState<Record<string, boolean>>({});
    const [showManualSections, setShowManualSections] = useState(false);
    const [taskRateSearch, setTaskRateSearch] = useState('');
    const [taskRateCategory, setTaskRateCategory] = useState<'all' | 'overridden' | string>('all');

    const safeSqft = Math.max(100, sqft || 0);
    const effectiveOverheadPercent = mode === 'client' ? LEAD_LOCKED_OVERHEAD_PERCENT : overheadPercent;
    const effectiveProfitPercent = mode === 'client' ? LEAD_LOCKED_PROFIT_PERCENT : profitPercent;
    const roomTotalSqft = useMemo(() => rooms.reduce((sum, r) => sum + (r.sqft || 0), 0), [rooms]);
    const selectedBuildingType = useMemo(
        () => BUILDING_TYPES.find((b) => b.id === buildingTypeId) ?? BUILDING_TYPES[0],
        [buildingTypeId]
    );

    useEffect(() => {
        setRooms(getDefaultRooms(buildingTypeId, safeSqft));
        initializedSqftRef.current = true;
        prevSqftRef.current = safeSqft;
        syncingRoomsFromSqftRef.current = false;
        if (!useProductionOverride) {
            setProductionRateOverride(selectedBuildingType.productionRate);
        }
    }, [buildingTypeId, selectedBuildingType.productionRate, useProductionOverride]);

    useEffect(() => {
        if (!initializedSqftRef.current || rooms.length === 0) {
            return;
        }
        const prev = prevSqftRef.current;
        if (prev <= 0 || prev === safeSqft) return;
        syncingRoomsFromSqftRef.current = true;
        setRooms((prevRooms) => {
            const total = prevRooms.reduce((sum, r) => sum + (r.sqft || 0), 0);
            if (total <= 0) return prevRooms;
            if (total === safeSqft) return prevRooms;

            const weighted = prevRooms.map((r) => ((r.sqft || 0) / total) * safeSqft);
            const floors = weighted.map((w) => Math.max(0, Math.floor(w)));
            let remaining = Math.max(0, safeSqft - floors.reduce((sum, v) => sum + v, 0));

            const order = weighted
                .map((w, idx) => ({ idx, frac: w - Math.floor(w) }))
                .sort((a, b) => b.frac - a.frac);
            for (let i = 0; i < order.length && remaining > 0; i += 1) {
                floors[order[i].idx] += 1;
                remaining -= 1;
            }

            return prevRooms.map((r, idx) => ({
                ...r,
                sqft: floors[idx],
            }));
        });
        prevSqftRef.current = safeSqft;
    }, [safeSqft, rooms.length]);

    useEffect(() => {
        if (!initializedSqftRef.current) return;
        if (roomTotalSqft <= 0) return;
        if (syncingRoomsFromSqftRef.current) {
            if (roomTotalSqft === safeSqft) {
                syncingRoomsFromSqftRef.current = false;
            }
            return;
        }
        if (roomTotalSqft !== safeSqft) {
            const nextSqft = roomTotalSqft;
            prevSqftRef.current = nextSqft;
            setSqft(nextSqft);
        }
    }, [roomTotalSqft, safeSqft]);

    useEffect(() => {
        const onScroll = () => setShowStickySummary(window.scrollY > 280);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const stateDefaults = useMemo(() => getStateDefaults(stateCode) ?? {}, [stateCode]);
    const hasTaskRateOverrides = useMemo(
        () => Object.values(taskRateOverrides).some((v) => Number.isFinite(v) && v > 0),
        [taskRateOverrides]
    );
    const taskRateCountsByCategory = useMemo(() => {
        const counts: Record<string, number> = { all: CLEANING_TASKS.length, overridden: 0 };
        for (const cat of TASK_CATEGORIES) counts[cat.id] = 0;
        for (const task of CLEANING_TASKS) {
            counts[task.category] = (counts[task.category] || 0) + 1;
            if ((taskRateOverrides[task.id] || 0) > 0) counts.overridden += 1;
        }
        return counts;
    }, [taskRateOverrides]);
    const filteredTaskRates = useMemo(() => {
        const q = taskRateSearch.trim().toLowerCase();
        return CLEANING_TASKS.filter((task) => {
            if (taskRateCategory === 'overridden' && !(taskRateOverrides[task.id] > 0)) return false;
            if (taskRateCategory !== 'all' && taskRateCategory !== 'overridden' && task.category !== taskRateCategory) return false;
            if (!q) return true;
            return task.name.toLowerCase().includes(q) || task.id.toLowerCase().includes(q) || task.category.toLowerCase().includes(q);
        });
    }, [taskRateSearch, taskRateCategory, taskRateOverrides]);
    const inputs = useMemo(
        () => ({
            ...DEFAULT_INPUTS,
            ...stateDefaults,
            buildingTypeId,
            sqft: safeSqft,
            frequency,
            overheadPercent: effectiveOverheadPercent,
            profitPercent: effectiveProfitPercent,
            productionRateOverride: mode === 'contractor' && useProductionOverride && productionRateOverride > 0 ? productionRateOverride : undefined,
            taskMinutesPer1kOverrides: hasTaskRateOverrides ? taskRateOverrides : undefined,
        }),
        [mode, stateDefaults, buildingTypeId, safeSqft, frequency, effectiveOverheadPercent, effectiveProfitPercent, useProductionOverride, productionRateOverride, hasTaskRateOverrides, taskRateOverrides]
    );

    const results = useMemo(() => calculate(inputs, rooms), [inputs, rooms]);
    const inArea = useMemo(() => isServedArea(stateCode, county), [stateCode, county]);
    const osUrl = useMemo(
        () =>
            buildXiriOsUrl({
                state: stateCode,
                buildingTypeId,
                sqft: safeSqft,
                frequency,
                estimate: results.totalPricePerMonth,
            }),
        [stateCode, buildingTypeId, safeSqft, frequency, results.totalPricePerMonth]
    );
    const onboardingUrl = useMemo(() => buildVendorOnboardingUrl(county), [county]);

    const fmt = (n: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n || 0);

    const setRoomSqft = (roomId: string, value: number) => {
        setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, sqft: Math.max(0, value) } : r)));
    };

    const addRoom = (roomTypeId = 'custom') => {
        const roomType = ROOM_TYPES.find((r) => r.id === roomTypeId) ?? ROOM_TYPES.find((r) => r.id === 'custom') ?? ROOM_TYPES[0];
        const roomId = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const defaultSqft = Math.max(100, Math.round(safeSqft / Math.max(rooms.length + 1, 1)));
        setRooms((prev) => [
            ...prev,
            {
                id: roomId,
                roomTypeId: roomType.id,
                sqft: defaultSqft,
                tasks: [...roomType.defaultTasks],
            },
        ]);
    };

    const removeRoom = (roomId: string) => {
        setRooms((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== roomId)));
    };

    const setRoomType = (roomId: string, roomTypeId: string) => {
        const roomType = ROOM_TYPES.find((r) => r.id === roomTypeId);
        if (!roomType) return;
        setRooms((prev) =>
            prev.map((r) =>
                r.id === roomId
                    ? {
                        ...r,
                        roomTypeId: roomType.id,
                        tasks: [...roomType.defaultTasks],
                    }
                    : r
            )
        );
    };

    const toggleRoomTask = (roomId: string, taskId: string) => {
        setRooms((prev) =>
            prev.map((r) => {
                if (r.id !== roomId) return r;
                const has = r.tasks.includes(taskId);
                const nextTasks = has ? r.tasks.filter((t) => t !== taskId) : [...r.tasks, taskId];
                return { ...r, tasks: nextTasks };
            })
        );
    };

    const setTaskSearch = (roomId: string, value: string) => {
        setTaskSearchByRoom((prev) => ({ ...prev, [roomId]: value }));
    };
    const setTaskCategory = (roomId: string, value: string) => {
        setTaskCategoryByRoom((prev) => ({ ...prev, [roomId]: value }));
    };
    const setSelectedOnly = (roomId: string, value: boolean) => {
        setSelectedOnlyByRoom((prev) => ({ ...prev, [roomId]: value }));
    };

    const normalizeWizardRoom = (room: NonNullable<WizardParsedValues['rooms']>[number], fallbackSqft: number): RoomScope => {
        const roomTypeId = ROOM_TYPES.some((r) => r.id === room.roomTypeId) ? (room.roomTypeId as string) : 'custom';
        const roomType = ROOM_TYPES.find((r) => r.id === roomTypeId) ?? ROOM_TYPES.find((r) => r.id === 'custom') ?? ROOM_TYPES[0];
        const validTasks = Array.isArray(room.tasks)
            ? room.tasks.filter((taskId) => CLEANING_TASKS.some((task) => task.id === taskId))
            : [];
        const baseSqft = Number.isFinite(room.sqft) && (room.sqft as number) > 0 ? Math.round(room.sqft as number) : fallbackSqft;
        return {
            id: `room-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            roomTypeId,
            sqft: Math.max(0, baseSqft),
            tasks: validTasks.length > 0 ? validTasks : [...roomType.defaultTasks],
        };
    };

    const applyWizardPrompt = async () => {
        const parsedLocal = parseWizardPrompt(wizardPrompt);
        let parsed: WizardParsedValues = { ...parsedLocal };

        if (onAiParsePrompt) {
            try {
                const parsedAI = await onAiParsePrompt(wizardPrompt);
                if (parsedAI) {
                    const ai = parsedAI as Partial<WizardParsedValues>;
                    parsed = {
                        ...ai,
                        ...parsedLocal, // deterministic parser wins when both are present
                        // These are usually only present from AI and should still flow through.
                        rooms: ai.rooms ?? parsedLocal.rooms,
                        taskMinutesPer1kOverrides:
                            ai.taskMinutesPer1kOverrides ?? parsedLocal.taskMinutesPer1kOverrides,
                    };
                }
            } catch {
                // keep local parser results only
            }
        }

        let updates = 0;
        const missing: string[] = [];
        if (parsed.buildingTypeId) {
            setBuildingTypeId(parsed.buildingTypeId);
            updates++;
        } else {
            missing.push('building type');
        }
        if (parsed.stateCode) {
            setStateCode(parsed.stateCode);
            if (parsed.stateCode !== 'NY') setCounty('unknown');
            updates++;
        } else {
            missing.push('state');
        }
        const resolvedState = parsed.stateCode ?? stateCode;
        if (parsed.county && resolvedState === 'NY') {
            setCounty(parsed.county);
            updates++;
        }
        if (parsed.sqft) {
            setSqft(parsed.sqft);
            updates++;
        } else {
            missing.push('square footage');
        }
        if (parsed.frequency) {
            setFrequency(parsed.frequency);
            updates++;
        } else {
            missing.push('cleaning frequency');
        }
        if (mode === 'contractor' && parsed.productionRate) {
            setUseProductionOverride(true);
            setShowAdvancedProduction(true);
            setProductionRateOverride(parsed.productionRate);
            updates++;
        }
        if (mode === 'contractor' && parsed.taskMinutesPer1kOverrides && Object.keys(parsed.taskMinutesPer1kOverrides).length > 0) {
            setTaskRateOverrides((prev) => ({ ...prev, ...parsed.taskMinutesPer1kOverrides }));
            setShowAdvancedProduction(true);
            setShowAdvancedTaskRates(true);
            updates++;
        }
        if (parsed.rooms && parsed.rooms.length > 0) {
            const fallbackSqft = Math.max(100, Math.round(safeSqft / Math.max(parsed.rooms.length, 1)));
            const normalizedRooms = parsed.rooms.map((room) => normalizeWizardRoom(room, fallbackSqft));
            setRooms((prev) => (parsed.replaceRooms ? normalizedRooms : [...prev, ...normalizedRooms]));
            updates++;
        }

        if (updates > 0) {
            setWizardStatus(`Great start. I updated ${updates} field${updates > 1 ? 's' : ''}.`);
            setShowManualSections(true);
            const nudgePool: string[] = [];
            if (missing.includes('building type')) {
                nudgePool.push('What type of building is it? (office, medical, school, retail...)');
            }
            if (missing.includes('state')) {
                nudgePool.push('What state is the facility in?');
            }
            if (missing.includes('square footage')) {
                nudgePool.push('Approximately how many square feet is the facility?');
            }
            if (missing.includes('cleaning frequency')) {
                nudgePool.push('How often should it be cleaned? (example: 5x/week)');
            }
            if (!parsed.rooms || parsed.rooms.length === 0) {
                nudgePool.push('If you know the layout, list zones like lobby 1,500 sqft, offices 6,000 sqft, restrooms 1,000 sqft.');
            }
            setWizardNudges(nudgePool.slice(0, 3));
        } else {
            setWizardStatus('I can help fill this out. Give me a little more detail and I’ll do the rest.');
            setWizardNudges([
                'Tell me your building type and square footage.',
                'Add the state and cleaning frequency (like 3x/week or daily).',
                'Optional: include room-by-room zones and any task-level ISSA overrides.',
            ]);
        }
    };

    const setTaskRateOverride = (taskId: string, value: number) => {
        setTaskRateOverrides((prev) => ({
            ...prev,
            [taskId]: Math.max(0, value),
        }));
    };

    return (
        <>
            {showStickySummary && (
                <div className="fixed top-[84px] left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
                    <div className="rounded-xl border border-sky-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-slate-600">Live Bid Summary</div>
                            <div className="text-sm sm:text-base font-semibold text-sky-700">
                                {fmt(results.totalPricePerMonth)} <span className="text-slate-500 font-normal">/month</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
                <section className="rounded-2xl border border-slate-300 bg-white p-4 space-y-2 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Quick Fill</h3>
                    <p className="text-xs text-slate-500">Fastest way to quote: describe the space once and I’ll pre-fill the details for you.</p>
                    <textarea
                        value={wizardPrompt}
                        onChange={(e) => setWizardPrompt(e.target.value)}
                        placeholder="Example: 12,000 sqft medical clinic in Queens, New York, cleaned 5x/week, production rate 3200 sqft/hr."
                        className="w-full rounded-xl border border-slate-300 bg-white min-h-24 px-3 py-2 text-sm"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={applyWizardPrompt}
                            className="rounded-lg bg-sky-700 text-white text-sm font-semibold px-3.5 py-2 hover:bg-sky-800"
                        >
                            Quick Fill Now
                        </button>
                        {wizardStatus && <p className="text-xs text-slate-600">{wizardStatus}</p>}
                    </div>
                    {wizardNudges.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {wizardNudges.map((nudge) => (
                                <button
                                    key={nudge}
                                    type="button"
                                    onClick={() => setWizardPrompt((prev) => (prev ? `${prev}\n${nudge}` : nudge))}
                                    className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
                                >
                                    {nudge}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="font-semibold text-slate-900">Manual Details</h3>
                            <p className="text-xs text-slate-500">
                                Start with Quick Fill first, then open manual controls only if you need to adjust the quote.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowManualSections((v) => !v)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            {showManualSections ? 'Hide Details' : 'Review / Edit Details'}
                        </button>
                    </div>
                </section>

                {showManualSections && (
                <>
                <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-3">Building Type</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                        {BUILDING_TYPES.slice(0, FEATURED_BUILDING_TYPES).map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => setBuildingTypeId(b.id)}
                                className={`rounded-xl border px-3 py-2 text-left text-sm flex items-center gap-2 min-h-14 ${
                                    buildingTypeId === b.id
                                        ? 'border-sky-500 bg-sky-50 text-sky-800'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                <span className="text-lg leading-none">{b.icon}</span>
                                <div className="font-medium">{b.name}</div>
                            </button>
                        ))}
                    </div>
                    {BUILDING_TYPES.length > FEATURED_BUILDING_TYPES && (
                        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                            <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center justify-between">
                                <span>More building types</span>
                                <span aria-hidden className="text-slate-500">▾</span>
                            </summary>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                {BUILDING_TYPES.slice(FEATURED_BUILDING_TYPES).map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setBuildingTypeId(b.id)}
                                        className={`rounded-xl border px-3 py-2 text-left text-sm flex items-center gap-2 min-h-14 ${
                                            buildingTypeId === b.id
                                                ? 'border-sky-500 bg-sky-50 text-sky-800'
                                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="text-lg leading-none">{b.icon}</span>
                                        <div className="font-medium">{b.name}</div>
                                    </button>
                                ))}
                            </div>
                        </details>
                    )}
                </section>

                {mode === 'contractor' && (
                <section className="rounded-2xl border border-slate-300 bg-white p-4 space-y-3 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Pricing Assumptions</h3>
                    <p className="text-xs text-slate-500">
                        Defaults: {LEAD_LOCKED_OVERHEAD_PERCENT}% overhead and {LEAD_LOCKED_PROFIT_PERCENT}% profit.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <span className="text-xs uppercase tracking-wide text-slate-500">Overhead %</span>
                            <input
                                type="range"
                                min={0}
                                max={40}
                                step={1}
                                value={overheadPercent}
                                onChange={(e) => setOverheadPercent(Number(e.target.value))}
                                className="mt-2 w-full"
                            />
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={overheadPercent}
                                onChange={(e) => setOverheadPercent(Math.max(0, Number(e.target.value) || 0))}
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white h-9 px-2 text-sm"
                            />
                        </label>
                        <label className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <span className="text-xs uppercase tracking-wide text-slate-500">Profit %</span>
                            <input
                                type="range"
                                min={0}
                                max={50}
                                step={1}
                                value={profitPercent}
                                onChange={(e) => setProfitPercent(Number(e.target.value))}
                                className="mt-2 w-full"
                            />
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={profitPercent}
                                onChange={(e) => setProfitPercent(Math.max(0, Number(e.target.value) || 0))}
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white h-9 px-2 text-sm"
                            />
                        </label>
                    </div>
                </section>
                )}

                <section className="rounded-2xl border border-slate-300 bg-white p-4 space-y-3 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Size & Frequency</h3>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-slate-500">State</label>
                        <select
                            value={stateCode}
                            onChange={(e) => setStateCode(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                        >
                            {STATES.map((s) => (
                                <option key={s.code} value={s.code}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-slate-500">Square Footage</label>
                        <input
                            value={sqft ? sqft.toLocaleString('en-US') : ''}
                            onChange={(e) => setSqft(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-slate-500">Cleaning Frequency</label>
                        <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
                            {FREQUENCIES.filter((f) => f.group === 'recurring').map((f) => (
                                <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => setFrequency(f.value)}
                                    className={`min-w-14 rounded-lg border px-3 py-2 text-sm whitespace-nowrap ${
                                        frequency === f.value
                                            ? 'border-sky-500 bg-sky-50 text-sky-800'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    {f.value}x
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'contractor' && stateCode === 'NY' && (
                        <div>
                            <label className="text-xs uppercase tracking-wide text-slate-500">Your Service Area</label>
                            <select
                                value={county}
                                onChange={(e) => setCounty(e.target.value as ServedCounty)}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                            >
                                <option value="unknown">Select county</option>
                                <option value="nassau">Nassau County, New York</option>
                                <option value="suffolk">Suffolk County, New York</option>
                                <option value="queens">Queens County, New York</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-300 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">Cleaning Scope</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs rounded-full bg-sky-100 text-sky-800 px-2 py-0.5">{rooms.length} rooms</span>
                            <details className="relative">
                                <summary className="list-none cursor-pointer text-xs rounded-lg border border-sky-300 text-sky-700 px-2.5 py-1 hover:bg-sky-50 flex items-center gap-1">
                                    <span>+ Add Zone</span>
                                    <span aria-hidden>▾</span>
                                </summary>
                                <div className="absolute right-0 mt-1 z-20 w-[min(92vw,560px)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {ROOM_TYPES.map((rt) => (
                                        <button
                                            key={rt.id}
                                            type="button"
                                            onClick={() => addRoom(rt.id)}
                                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-left flex items-start gap-2 text-slate-700 hover:border-slate-300"
                                        >
                                            <span className="text-sm">{rt.icon}</span>
                                            <span className="whitespace-normal leading-tight">{rt.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </details>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {rooms.map((room, roomIndex) => {
                            const roomType = ROOM_TYPES.find((r) => r.id === room.roomTypeId);
                            const selectedTasks = CLEANING_TASKS.filter((t) => room.tasks.includes(t.id));
                            const taskSearch = (taskSearchByRoom[room.id] || '').trim().toLowerCase();
                            const categoryFilter = taskCategoryByRoom[room.id] || 'all';
                            const selectedOnly = selectedOnlyByRoom[room.id] || false;
                            const visibleTasks = CLEANING_TASKS.filter((task) => {
                                if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
                                if (selectedOnly && !room.tasks.includes(task.id)) return false;
                                if (taskSearch) {
                                    const q = taskSearch.toLowerCase();
                                    if (!task.name.toLowerCase().includes(q) && !task.id.toLowerCase().includes(q)) return false;
                                }
                                return true;
                            });
                            return (
                                <div
                                    key={room.id}
                                    className={`rounded-xl border p-3 ${
                                        roomIndex % 2 === 0
                                            ? 'border-slate-300 bg-white'
                                            : 'border-slate-300 bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                                        <div className="flex items-start gap-2">
                                            <span className="mt-0.5 text-base leading-none">{roomType?.icon || '•'}</span>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <details className="group relative">
                                                        <summary className="list-none cursor-pointer text-sm rounded-md border border-slate-300 bg-white min-h-8 px-2 py-1 text-slate-800 flex items-center gap-2 min-w-[230px] sm:min-w-[280px]">
                                                            <span>{roomType?.icon ?? '🧩'}</span>
                                                            <span className="whitespace-normal leading-tight">{roomType?.name ?? 'Select zone type'}</span>
                                                            <span className="ml-auto text-slate-500">▾</span>
                                                        </summary>
                                                        <div className="absolute mt-1 z-20 w-[min(92vw,560px)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                            {ROOM_TYPES.map((rt) => (
                                                                <button
                                                                    key={rt.id}
                                                                    type="button"
                                                                    onClick={() => setRoomType(room.id, rt.id)}
                                                                    className={`rounded-lg border px-2 py-1.5 text-xs text-left flex items-start gap-2 ${
                                                                        room.roomTypeId === rt.id
                                                                            ? 'border-sky-500 bg-sky-50 text-sky-800'
                                                                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                                                    }`}
                                                                >
                                                                    <span className="text-sm">{rt.icon}</span>
                                                                    <span className="whitespace-normal leading-tight">{rt.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </details>
                                                    {rooms.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRoom(room.id)}
                                                            className="text-xs rounded-md border border-rose-300 text-rose-700 px-2 py-1 hover:bg-rose-50"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500">{room.tasks.length} tasks selected</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={(room.sqft || 0).toLocaleString('en-US')}
                                                onChange={(e) => setRoomSqft(room.id, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                                                className="w-24 rounded-lg border border-slate-300 bg-white h-9 px-2 text-sm text-right"
                                            />
                                            <span className="text-xs text-slate-500">sqft</span>
                                        </div>
                                    </div>
                                    <details className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-2">
                                        <summary className="cursor-pointer text-xs font-medium text-sky-700 flex items-center justify-between">
                                            <span>Task Checklist</span>
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <span>{room.tasks.length} selected</span>
                                                <span aria-hidden>▾</span>
                                            </span>
                                        </summary>
                                        <div className="mt-2">
                                            <input
                                                type="text"
                                                value={taskSearchByRoom[room.id] || ''}
                                                onChange={(e) => setTaskSearch(room.id, e.target.value)}
                                                placeholder="Search tasks..."
                                                className="w-full rounded-md border border-slate-300 bg-white h-8 px-2.5 text-xs text-slate-700"
                                            />
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setTaskCategory(room.id, 'all')}
                                                className={`text-[11px] rounded-full px-2 py-1 border ${categoryFilter === 'all' ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-300 text-slate-600'}`}
                                            >
                                                All
                                            </button>
                                            {TASK_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setTaskCategory(room.id, cat.id)}
                                                    className={`text-[11px] rounded-full px-2 py-1 border ${categoryFilter === cat.id ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-300 text-slate-600'}`}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                            <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOnly}
                                                    onChange={(e) => setSelectedOnly(room.id, e.target.checked)}
                                                />
                                                Selected only
                                            </label>
                                        </div>
                                        <div className="mt-2 space-y-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white p-1.5">
                                            {visibleTasks.map((task) => {
                                                const checked = room.tasks.includes(task.id);
                                                return (
                                                    <label key={task.id} className="flex items-center gap-2 px-1.5 py-1 text-sm text-slate-700 rounded hover:bg-slate-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleRoomTask(room.id, task.id)}
                                                        />
                                                        <span>{task.name}</span>
                                                    </label>
                                                );
                                            })}
                                            {visibleTasks.length === 0 && (
                                                <p className="px-1.5 py-2 text-xs text-slate-500">No matching tasks.</p>
                                            )}
                                            <div className="pt-2 border-t border-slate-100">
                                                <p className="text-xs text-slate-500">Selected:</p>
                                                <p className="text-xs text-slate-700">
                                                    {selectedTasks.map((t) => t.name).join(', ') || 'No tasks selected'}
                                                </p>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 text-right">
                        Room total: {roomTotalSqft.toLocaleString('en-US')} / {safeSqft.toLocaleString('en-US')} sqft
                    </p>
                </section>

                {mode === 'contractor' && (
                <section className="rounded-2xl border border-slate-300 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">Production Rate</h3>
                        <button
                            type="button"
                            onClick={() => setShowAdvancedProduction((v) => !v)}
                            className="text-xs font-medium text-sky-700 hover:text-sky-800"
                        >
                            {showAdvancedProduction ? 'Hide Advanced' : 'Show Advanced'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-600">
                        Default uses ISSA standard for <span className="font-medium">{selectedBuildingType.name}</span>:
                        <span className="font-semibold"> {selectedBuildingType.productionRate.toLocaleString('en-US')} sqft/hr</span>
                    </p>
                    {showAdvancedProduction && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={useProductionOverride}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setUseProductionOverride(checked);
                                        if (!checked) setProductionRateOverride(selectedBuildingType.productionRate);
                                    }}
                                />
                                Use custom production rate
                            </label>
                            {useProductionOverride && (
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Custom Production Rate (sqft/hour)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={productionRateOverride ? productionRateOverride.toLocaleString('en-US') : ''}
                                        onChange={(e) =>
                                            setProductionRateOverride(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)
                                        }
                                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                                    />
                                </div>
                            )}
                            <div className="pt-1 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedTaskRates((v) => !v)}
                                    className="text-sm font-medium text-sky-700 hover:text-sky-800"
                                >
                                    {showAdvancedTaskRates ? 'Hide Task-Level ISSA Overrides' : 'Show Task-Level ISSA Overrides'}
                                </button>
                                <p className="mt-1 text-xs text-slate-500">
                                    Optional: override minutes per 1,000 sqft per task. Leave blank to use ISSA defaults.
                                </p>
                            </div>
                            {showAdvancedTaskRates && (
                                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Task-level rates (min / 1,000 sqft)</p>
                                        <button
                                            type="button"
                                            onClick={() => setTaskRateOverrides({})}
                                            className="text-xs font-medium text-slate-600 hover:text-slate-800"
                                        >
                                            Reset to ISSA defaults
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            value={taskRateSearch}
                                            onChange={(e) => setTaskRateSearch(e.target.value)}
                                            placeholder="Search task-level rates..."
                                            className="w-full rounded-lg border border-slate-300 bg-white h-9 px-2.5 text-sm"
                                        />
                                        <div className="flex items-center gap-1.5 flex-wrap justify-start lg:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setTaskRateCategory('all')}
                                                className={`text-[11px] rounded-full px-2 py-1 border ${taskRateCategory === 'all' ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-300 text-slate-600'}`}
                                            >
                                                All {taskRateCountsByCategory.all}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTaskRateCategory('overridden')}
                                                className={`text-[11px] rounded-full px-2 py-1 border ${taskRateCategory === 'overridden' ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-300 text-slate-600'}`}
                                            >
                                                Overridden {taskRateCountsByCategory.overridden}
                                            </button>
                                            {TASK_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setTaskRateCategory(cat.id)}
                                                    className={`text-[11px] rounded-full px-2 py-1 border ${taskRateCategory === cat.id ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-300 text-slate-600'}`}
                                                >
                                                    {cat.label} {taskRateCountsByCategory[cat.id] || 0}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-72 overflow-auto pr-1">
                                        {filteredTaskRates.map((task) => (
                                            <div key={task.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px] gap-2 items-center rounded-lg border border-slate-100 p-2">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{task.name}</p>
                                                    <p className="text-xs text-slate-500">Default ISSA: {task.minutesPer1kSqft} min / 1k sqft</p>
                                                </div>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={taskRateOverrides[task.id] ? String(taskRateOverrides[task.id]) : ''}
                                                    onChange={(e) => {
                                                        const parsed = Number(e.target.value.replace(/[^0-9.]/g, ''));
                                                        setTaskRateOverride(task.id, Number.isFinite(parsed) ? parsed : 0);
                                                    }}
                                                    placeholder={String(task.minutesPer1kSqft)}
                                                    className="w-full rounded-lg border border-slate-300 bg-white h-9 px-2.5 text-sm"
                                                />
                                            </div>
                                        ))}
                                        {filteredTaskRates.length === 0 && (
                                            <p className="text-xs text-slate-500">No task rates match this filter.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
                )}
                </>
                )}
            </div>

            <aside className="rounded-2xl border border-slate-300 bg-white p-4 space-y-4 h-fit lg:sticky lg:top-24 shadow-sm">
                <h3 className="font-semibold text-slate-900">Bid Summary</h3>
                <div>
                    <p className="text-3xl font-bold text-sky-700">{fmt(results.totalPricePerMonth)}</p>
                    <p className="text-sm text-slate-500">/month</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Per Visit</p>
                        <p className="font-semibold">{fmt(results.pricePerVisit)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Visits / Mo</p>
                        <p className="font-semibold">{results.visitsPerMonth}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Hrs / Visit</p>
                        <p className="font-semibold">{results.hoursPerVisit.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Per Sqft</p>
                        <p className="font-semibold">${results.pricePerSqft.toFixed(3)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 col-span-2">
                        <p className="text-slate-500">Quote / Hr</p>
                        <p className="font-semibold">{fmt(results.effectiveHourlyRate)}</p>
                    </div>
                </div>

                {mode === 'contractor' ? (
                    <div className="space-y-2">
                        {inArea ? (
                            <>
                                <a
                                    href={onboardingUrl}
                                    className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800"
                                >
                                    Continue To Vendor Onboarding
                                </a>
                                <a
                                    href={osUrl}
                                    className="block w-full text-center rounded-xl border border-sky-300 text-sky-700 font-semibold py-2.5 hover:bg-sky-50"
                                >
                                    Save Bid & Create xiriOS account
                                </a>
                                <p className="text-xs text-slate-500">In Nassau, Suffolk, and Queens we can onboard you directly into our managed network.</p>
                            </>
                        ) : (
                            <>
                                <a
                                    href={osUrl}
                                    className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800"
                                >
                                    Save Bid & Create xiriOS account
                                </a>
                                <p className="text-xs text-slate-500">Outside our current managed-service area, continue in XIRI OS.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <a href="/#audit" className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800">
                        Get Free Site Audit
                    </a>
                )}
            </aside>
            </div>
        </>
    );
}
