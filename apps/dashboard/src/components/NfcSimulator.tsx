'use client';

/**
 * NFC Simulator — DEV ONLY
 *
 * Floating widget that simulates NFC tag taps for local testing.
 * This component checks NODE_ENV and renders nothing in production.
 * 
 * Usage:
 *   {process.env.NODE_ENV === 'development' && (
 *       <NfcSimulator zones={wo.nfcZones} onTap={(tagId) => handleNfcTap(tagId)} />
 *   )}
 */

import { useState } from 'react';
import { WorkOrderNfcZone } from '@xiri-facility-solutions/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ChevronDown, ChevronUp, Smartphone, Wifi, CheckCircle2,
} from 'lucide-react';

interface NfcSimulatorProps {
    zones: WorkOrderNfcZone[];
    onTap: (tagId: string) => void;
}

export function NfcSimulator({ zones, onTap }: NfcSimulatorProps) {
    const [expanded, setExpanded] = useState(false);
    const [lastTapped, setLastTapped] = useState<string | null>(null);

    // Never render in production
    if (process.env.NODE_ENV !== 'development') return null;

    const handleTap = (tagId: string) => {
        setLastTapped(tagId);
        onTap(tagId);
        // Flash effect
        setTimeout(() => setLastTapped(null), 1500);
    };

    const scannedZones = zones.filter(z => z.scannedAt);
    const pendingZones = zones.filter(z => !z.scannedAt);

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Collapsed: just a floating badge */}
            {!expanded ? (
                <button
                    onClick={() => setExpanded(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-105 animate-pulse"
                >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs font-bold">NFC SIM</span>
                    <Badge className="bg-purple-800 text-purple-200 border-0 text-[10px] px-1.5">
                        {pendingZones.length}
                    </Badge>
                </button>
            ) : (
                /* Expanded: zone list */
                <div className="w-72 bg-background border border-purple-300 dark:border-purple-800 rounded-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            <span className="text-sm font-bold">NFC Simulator</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Badge className="bg-purple-800 text-purple-200 border-0 text-[10px]">DEV ONLY</Badge>
                            <button
                                onClick={() => setExpanded(false)}
                                className="p-1 hover:bg-purple-800 rounded transition-colors"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Zone list */}
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
                        {zones.length === 0 ? (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No NFC zones configured
                            </div>
                        ) : (
                            zones.map(zone => {
                                const isScanned = !!zone.scannedAt;
                                const justTapped = lastTapped === zone.tagId;

                                return (
                                    <div
                                        key={zone.zoneId}
                                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                                            justTapped
                                                ? 'border-green-400 bg-green-50 dark:bg-green-950/30 scale-[1.02]'
                                                : isScanned
                                                    ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10 opacity-60'
                                                    : 'border-border hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/10'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{zone.zoneName}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                                                {zone.tagId}
                                            </p>
                                            {zone.tagLocationHint && (
                                                <p className="text-[10px] text-muted-foreground/70 truncate">
                                                    📍 {zone.tagLocationHint}
                                                </p>
                                            )}
                                        </div>
                                        {isScanned ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2.5 text-xs border-purple-300 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-950 shrink-0"
                                                onClick={() => handleTap(zone.tagId)}
                                            >
                                                <Wifi className="w-3 h-3 mr-1" />
                                                Tap
                                            </Button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2 bg-muted/30 border-t text-[10px] text-muted-foreground text-center">
                        {scannedZones.length}/{zones.length} zones scanned • Simulated NFC
                    </div>
                </div>
            )}
        </div>
    );
}
