'use client';

import { useEffect, useState } from 'react';
import { DEBUG_EVENT_NAME, EventName, EventProperties } from '@/lib/tracking';

interface TrackedEvent {
    id: number;
    name: EventName;
    properties?: EventProperties;
    timestamp: string;
}

export function TrackingDebugOverlay() {
    const [events, setEvents] = useState<TrackedEvent[]>([]);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Only run in development
        if (process.env.NODE_ENV !== 'development') return;

        const handleDebugEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            const newEvent: TrackedEvent = {
                id: Date.now(),
                ...customEvent.detail,
            };

            setEvents((prev) => [newEvent, ...prev].slice(0, 5)); // Keep last 5 events
            setIsVisible(true);

            // Auto-hide after 5 seconds if no interaction
            const timer = setTimeout(() => {
                // We don't auto-hide completely, but could fade out. 
                // For now, let's keep it visible so user can see history.
            }, 5000);

            return () => clearTimeout(timer);
        };

        window.addEventListener(DEBUG_EVENT_NAME, handleDebugEvent);
        return () => window.removeEventListener(DEBUG_EVENT_NAME, handleDebugEvent);
    }, []);

    if (process.env.NODE_ENV !== 'development') return null;
    if (!isVisible && events.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
            <div className="bg-black/80 text-white p-2 rounded-t-lg text-xs font-mono w-64 flex justify-between items-center pointer-events-auto">
                <span className="font-bold text-green-400">● GA4 Debug</span>
                <button
                    onClick={() => setEvents([])} // Clear logs
                    className="text-gray-400 hover:text-white"
                >
                    Clear
                </button>
            </div>
            <div className="bg-black/80 text-white p-4 rounded-b-lg w-64 max-h-96 overflow-y-auto pointer-events-auto space-y-3 shadow-xl backdrop-blur-sm">
                {events.length === 0 ? (
                    <div className="text-gray-500 text-xs italic text-center py-2">
                        Waiting for events...
                    </div>
                ) : (
                    events.map((ev) => (
                        <div key={ev.id} className="border-l-2 border-green-500 pl-2 text-xs">
                            <div className="font-bold text-green-300 mb-1">{ev.name}</div>
                            <div className="text-gray-400 mb-1">{new Date(ev.timestamp).toLocaleTimeString()}</div>
                            {ev.properties && (
                                <div className="space-y-1">
                                    {Object.entries(ev.properties).map(([key, val]) => (
                                        <div key={key} className="grid grid-cols-[1fr_2fr] gap-2">
                                            <span className="text-gray-500 truncate">{key}:</span>
                                            <span className="text-gray-300 truncate font-mono">{String(val)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
