'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder, CheckIn } from '@xiri/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Shield, MapPin, Clock, Star, Trophy, Zap, ChevronRight,
    CheckCircle2, QrCode, Flame
} from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AuditsPage() {
    const router = useRouter();
    const { profile } = useAuth();
    const [tonightsWOs, setTonightsWOs] = useState<(WorkOrder & { id: string })[]>([]);
    const [recentCheckIns, setRecentCheckIns] = useState<(CheckIn & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    // Stats
    const [totalAudits, setTotalAudits] = useState(0);
    const [streak, setStreak] = useState(0);
    const [avgScore, setAvgScore] = useState(0);

    useEffect(() => {
        // Fetch active work orders for tonight
        const today = new Date().getDay(); // 0=Sun
        const q = query(
            collection(db, 'work_orders'),
            where('status', '==', 'active'),
        );
        const unsub = onSnapshot(q, (snap) => {
            const allWOs = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }));
            // Filter to tonight's scheduled WOs
            let tonight = allWOs.filter(wo => wo.schedule?.daysOfWeek?.[today]);
            // Night managers only see WOs assigned to them; admins see all
            const isAdmin = profile?.roles?.includes('admin');
            if (!isAdmin && profile?.uid) {
                tonight = tonight.filter(wo => (wo as any).assignedNightManagerId === profile.uid);
            }
            setTonightsWOs(tonight);
            setLoading(false);
        });

        // Fetch recent check-ins
        const checkInQuery = query(
            collection(db, 'check_ins'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        const unsub2 = onSnapshot(checkInQuery, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CheckIn & { id: string }));
            setRecentCheckIns(data);

            // Calculate stats
            setTotalAudits(data.length);
            if (data.length > 0) {
                const avg = data.reduce((sum, ci) => sum + (ci.auditScore || 0), 0) / data.length;
                setAvgScore(Math.round(avg * 10) / 10);
            }

            // Calculate streak (consecutive days with at least one check-in)
            const dates = new Set(data.map(ci => ci.checkInDate));
            let s = 0;
            const d = new Date();
            for (let i = 0; i < 30; i++) {
                const key = d.toISOString().split('T')[0];
                if (dates.has(key)) {
                    s++;
                } else if (i > 0) break;
                d.setDate(d.getDate() - 1);
            }
            setStreak(s);
        });

        return () => { unsub(); unsub2(); };
    }, [profile?.uid, profile?.roles]);

    // Check which WOs already have a check-in tonight
    const todayStr = new Date().toISOString().split('T')[0];
    const checkedInWOIds = new Set(
        recentCheckIns
            .filter(ci => ci.checkInDate === todayStr)
            .map(ci => ci.workOrderId)
    );

    const pendingWOs = tonightsWOs.filter(wo => !checkedInWOIds.has(wo.id));
    const doneWOs = tonightsWOs.filter(wo => checkedInWOIds.has(wo.id));
    const tonightProgress = tonightsWOs.length > 0
        ? Math.round((doneWOs.length / tonightsWOs.length) * 100)
        : 0;

    if (loading) return <div className="p-8 flex justify-center">Loading tonight&apos;s schedule...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {/* Hero Header - Gamified */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm text-white/70">Good evening,</p>
                            <h1 className="text-2xl font-bold">{profile?.displayName?.split(' ')[0] || 'Manager'} 👋</h1>
                        </div>
                        <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <Flame className="w-4 h-4 text-orange-300" />
                            <span className="text-sm font-bold">{streak} day streak</span>
                        </div>
                    </div>

                    {/* Tonight's Progress */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-white/80">Tonight&apos;s Progress</span>
                            <span className="font-bold">{doneWOs.length}/{tonightsWOs.length} sites</span>
                        </div>
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 to-emerald-300 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${tonightProgress}%` }}
                            />
                        </div>
                    </div>

                    {tonightProgress === 100 && (
                        <div className="flex items-center gap-2 bg-green-500/30 backdrop-blur-sm rounded-lg px-3 py-2 mt-2">
                            <Trophy className="w-5 h-5 text-yellow-300" />
                            <span className="text-sm font-medium">All sites audited! Great work tonight! 🎉</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="text-center">
                    <CardContent className="p-3">
                        <Zap className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
                        <p className="text-xl font-bold">{totalAudits}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total Audits</p>
                    </CardContent>
                </Card>
                <Card className="text-center">
                    <CardContent className="p-3">
                        <Star className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                        <p className="text-xl font-bold">{avgScore || '—'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Avg Score</p>
                    </CardContent>
                </Card>
                <Card className="text-center">
                    <CardContent className="p-3">
                        <Flame className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                        <p className="text-xl font-bold">{streak}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Day Streak</p>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Audits - BIG TOUCH TARGETS */}
            {pendingWOs.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Ready to Audit ({pendingWOs.length})
                    </h2>
                    <div className="space-y-2">
                        {pendingWOs.map((wo) => (
                            <Card
                                key={wo.id}
                                className="cursor-pointer hover:border-primary/50 transition-all active:scale-[0.98] group"
                                onClick={() => router.push(`/operations/audits/check-in?woId=${wo.id}`)}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <QrCode className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{wo.locationName}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {wo.schedule?.startTime || 'Scheduled'} • {wo.serviceType}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                                            Pending
                                        </Badge>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Completed Tonight */}
            {doneWOs.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Done Tonight ({doneWOs.length})
                    </h2>
                    <div className="space-y-2">
                        {doneWOs.map((wo) => {
                            const checkIn = recentCheckIns.find(ci => ci.workOrderId === wo.id && ci.checkInDate === todayStr);
                            return (
                                <Card key={wo.id} className="opacity-70">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{wo.locationName}</p>
                                                <p className="text-xs text-muted-foreground">{wo.serviceType}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {checkIn && (
                                                <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star
                                                            key={s}
                                                            className={`w-3.5 h-3.5 ${s <= (checkIn.auditScore || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {tonightsWOs.length === 0 && (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-1">No audits scheduled tonight</h3>
                        <p className="text-sm text-muted-foreground">Check back tomorrow or verify your assigned work orders.</p>
                    </CardContent>
                </Card>
            )}

            {/* Recent History */}
            {recentCheckIns.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Recent Audits
                    </h2>
                    <Card>
                        <CardContent className="p-0 divide-y">
                            {recentCheckIns.slice(0, 10).map((ci) => (
                                <div key={ci.id} className="px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{ci.locationName}</p>
                                        <p className="text-xs text-muted-foreground">{ci.checkInDate} • {ci.serviceType}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className={`text-xs ${ci.completionRate === 100
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400'
                                                }`}
                                        >
                                            {ci.completionRate}%
                                        </Badge>
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star
                                                    key={s}
                                                    className={`w-3 h-3 ${s <= (ci.auditScore || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
