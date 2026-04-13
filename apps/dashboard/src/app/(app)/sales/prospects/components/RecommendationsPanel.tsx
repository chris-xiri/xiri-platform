import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Sparkles, AlertTriangle, PlusCircle, Trash2, Ban } from 'lucide-react';
import { ICP_CATEGORIES, SERVICE_COUNTIES } from './icp-data';
import type { ProspectingConfig, QueuedProspect } from './types';

export type RecommendationAction = 
  | { type: 'remove_query'; query: string }
  | { type: 'add_query'; query: string }
  | { type: 'remove_location'; location: string }
  | { type: 'add_exclude'; pattern: string }
  | { type: 'add_queries'; queries: string[] };

interface Recommendation {
    id: string; // unique hash to allow dismissal persistence
    type: 'remove' | 'add' | 'expand' | 'exclude';
    title: string;
    description: string;
    action: RecommendationAction;
    icon: React.ComponentType<{className?: string}>;
    colorClass: string;
}

interface RecommendationsPanelProps {
    config: ProspectingConfig | null;
    prospects: QueuedProspect[];
    onApply: (action: RecommendationAction, id: string) => Promise<void>;
    onDismiss: (id: string) => void;
}

export function RecommendationsPanel({ config, prospects, onApply, onDismiss }: RecommendationsPanelProps) {
    const recommendations = useMemo(() => {
        if (!config || !config.lastRunStats) return [];
        const recs: Recommendation[] = [];
        const sysDismissed = new Set(config.dismissedRecommendations || []);

        const stats = config.lastRunStats;
        const currentQueries = new Set(config.queries.map(q => q.toLowerCase()));
        
        // 1. Check Query Yields
        if (stats.queryYield) {
            Object.entries(stats.queryYield).forEach(([query, yieldData]) => {
                if (!currentQueries.has(query.toLowerCase())) return;
                
                // Zero yield
                if (yieldData.qualified === 0 && yieldData.discovered > 0) {
                    recs.push({
                        id: `remove_query_${query}`,
                        type: 'remove',
                        title: 'Zero Yield Query',
                        description: `Consider removing '${query}' — yielded 0 qualified prospects last run.`,
                        action: { type: 'remove_query', query },
                        icon: Trash2,
                        colorClass: 'bg-red-100 border-red-300 text-red-950',
                    });
                }
                
                // High yield -> suggest variations
                if (yieldData.qualified >= 8) {
                    const category = ICP_CATEGORIES.find(c => c.queries.map(q => q.toLowerCase()).includes(query.toLowerCase()));
                    if (category) {
                        const missing = category.queries.filter(q => !currentQueries.has(q.toLowerCase()));
                        if (missing.length > 0) {
                            recs.push({
                                id: `expand_category_${category.label}`,
                                type: 'expand',
                                title: `High Yield in ${category.label}`,
                                description: `'${query}' yielded ${yieldData.qualified} prospects. Add related: ${missing.slice(0, 2).join(', ')}`,
                                action: { type: 'add_queries', queries: missing },
                                icon: Sparkles,
                                colorClass: 'bg-amber-100 border-amber-300 text-amber-950',
                            });
                        }
                    }
                }
            });
        }

        // 2. Check Location Yields
        const currentLocs = new Set(config.locations.map(l => l.toLowerCase()));
        if (stats.locationYield) {
            Object.entries(stats.locationYield).forEach(([loc, yieldData]) => {
                if (!currentLocs.has(loc.toLowerCase())) return;

                if (yieldData.qualified === 0 && yieldData.discovered > 0) {
                    recs.push({
                        id: `remove_loc_${loc}`,
                        type: 'remove',
                        title: 'Dry Location',
                        description: `'${loc}' yielded nothing last run. Consider removing.`,
                        action: { type: 'remove_location', location: loc },
                        icon: AlertTriangle,
                        colorClass: 'bg-orange-100 border-orange-300 text-orange-950',
                    });
                }
                
                if (yieldData.qualified >= 10) {
                    const county = SERVICE_COUNTIES.find(c => c.towns.some(t => t.toLowerCase() === loc.split(',')[0].trim().toLowerCase()));
                    if (county) {
                        const missingTowns = county.towns.filter(t => !currentLocs.has(`${t}, NY`.toLowerCase()));
                        if (missingTowns.length > 0) {
                            recs.push({
                                id: `expand_loc_${loc}`,
                                type: 'expand',
                                title: 'Hot Location',
                                description: `High yield in ${loc}. Consider adding adjacent town ${missingTowns[0]}.`,
                                action: { type: 'add_query', query: `${missingTowns[0]}, NY` },
                                icon: PlusCircle,
                                colorClass: 'bg-blue-100 border-blue-300 text-blue-950',
                            });
                        }
                    }
                }
            });
        }

        // 3. Exclude pattern analysis
        const skippedNames = prospects
            .filter(p => p.status === 'skipped')
            .slice(0, 50)
            .map(p => p.businessName.toLowerCase());
            
        const wordCounts: Record<string, number> = {};
        skippedNames.forEach(name => {
            const words = name.split(/\s+/).filter(w => w.length > 4);
            words.forEach(w => {
                if (['inc', 'llc', 'corp', 'company', 'services'].includes(w)) return;
                wordCounts[w] = (wordCounts[w] || 0) + 1;
            });
        });

        Object.entries(wordCounts).forEach(([word, count]) => {
            if (count >= 5 && !config.excludePatterns.includes(word)) {
                recs.push({
                    id: `exclude_${word}`,
                    type: 'exclude',
                    title: 'Common Skipped Term',
                    description: `${count} recently skipped prospects contain '${word}'. Add to exclude list?`,
                    action: { type: 'add_exclude', pattern: word },
                    icon: Ban,
                    colorClass: 'bg-violet-100 border-violet-300 text-violet-950',
                });
            }
        });

        // Filter out dismissed recommendations
        return recs.filter(r => !sysDismissed.has(r.id)).slice(0, 4);
    }, [config, prospects]);

    const [applying, setApplying] = useState<string | null>(null);

    const handleApply = async (rec: Recommendation) => {
        setApplying(rec.id);
        await onApply(rec.action, rec.id);
        setApplying(null);
    };

    if (recommendations.length === 0) return null;

    return (
        <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Sparkles className="w-4 h-4 text-amber-500" />
                AI Agent Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {recommendations.map(rec => {
                    const Icon = rec.icon;
                    return (
                        <Card key={rec.id} className={`border overflow-hidden ${rec.colorClass}`}>
                            <div className="p-3 flex items-start gap-3">
                                <div className="mt-0.5 opacity-90"><Icon className="w-4 h-4" /></div>
                                <div className="flex-1 space-y-1">
                                    <h4 className="text-xs font-extrabold tracking-wide uppercase">{rec.title}</h4>
                                    <p className="text-[11px] leading-tight font-medium opacity-80">{rec.description}</p>
                                    <div className="flex items-center gap-2 pt-2">
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-6 text-[10px] px-2 bg-black/10 hover:bg-black/20 text-current border-0 font-bold"
                                            onClick={() => handleApply(rec)}
                                            disabled={applying === rec.id}
                                        >
                                            {applying === rec.id ? 'Applying...' : 'Apply'}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-6 text-[10px] px-2 opacity-60 hover:opacity-100 hover:bg-black/10"
                                            onClick={() => onDismiss(rec.id)}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
