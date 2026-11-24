'use client';

import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw, Download, X } from 'lucide-react';
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/persistence';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaLifecycle() {
    const [isOffline, setIsOffline] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIosHint, setShowIosHint] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Track online/offline connectivity
        setIsOffline(!navigator.onLine);
        const onOffline = () => setIsOffline(true);
        const onOnline = () => setIsOffline(false);
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);

        // Register Service Worker with update detection
        let refreshing = false;
        const onControllerChange = () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

            const register = async () => {
                try {
                    const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

                    if (reg.waiting) {
                        setWaitingWorker(reg.waiting);
                    }

                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setWaitingWorker(newWorker);
                            }
                        });
                    });
                } catch {
                    // Service worker registration optional
                }
            };

            if (document.readyState === 'complete') {
                void register();
            } else {
                window.addEventListener('load', () => { void register(); }, { once: true });
            }
        }

        // Capture install prompt (Android / Chrome / Edge)
        const dismissed = readStorage<boolean>(STORAGE_KEYS.INSTALL_DISMISSED, false);
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

        const onBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            if (!dismissed && !isStandalone) {
                setInstallPrompt(e as BeforeInstallPromptEvent);
            }
        };
        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

        // Detect iOS Safari not yet added to Home Screen
        const ua = window.navigator.userAgent;
        const isIos = /iPad|iPhone|iPod/.test(ua);
        const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        if (isIos && isSafari && !isStandalone && !dismissed) {
            setShowIosHint(true);
        }

        return () => {
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            }
        };
    }, []);

    const handleApplyUpdate = useCallback(() => {
        if (!waitingWorker) return;
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }, [waitingWorker]);

    const handleInstall = useCallback(async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        setInstallPrompt(null);
        if (choice.outcome === 'dismissed') {
            writeStorage(STORAGE_KEYS.INSTALL_DISMISSED, true);
        }
    }, [installPrompt]);

    const handleDismissInstall = useCallback(() => {
        setInstallPrompt(null);
        setShowIosHint(false);
        writeStorage(STORAGE_KEYS.INSTALL_DISMISSED, true);
    }, []);

    if (!isOffline && !waitingWorker && !installPrompt && !showIosHint) {
        return null;
    }

    return (
        <div className="fixed left-3 right-3 bottom-20 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm z-40 flex flex-col gap-2 pointer-events-none">
            {isOffline && (
                <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/95 text-amber-50 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md">
                    <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="flex-1 min-w-0 leading-snug">
                        You&apos;re offline — showing cached data. Changes sync when reconnected.
                    </span>
                </div>
            )}

            {waitingWorker && (
                <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-slate-900/95 text-white px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md">
                    <RefreshCw className="w-4 h-4 shrink-0 text-sky-400" />
                    <span className="flex-1 min-w-0">A newer version of XIRI is ready.</span>
                    <button
                        type="button"
                        onClick={handleApplyUpdate}
                        className="shrink-0 rounded-lg bg-sky-500 hover:bg-sky-400 px-2.5 py-1 font-semibold text-white transition-colors"
                    >
                        Update
                    </button>
                </div>
            )}

            {installPrompt && (
                <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-card/95 text-card-foreground px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md">
                    <Download className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span className="flex-1 min-w-0">Install XIRI for faster full-screen access.</span>
                    <button
                        type="button"
                        onClick={handleInstall}
                        className="shrink-0 rounded-lg bg-sky-600 hover:bg-sky-700 px-2.5 py-1 font-semibold text-white transition-colors"
                    >
                        Install
                    </button>
                    <button
                        type="button"
                        onClick={handleDismissInstall}
                        aria-label="Dismiss install prompt"
                        className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {showIosHint && !installPrompt && (
                <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-card/95 text-card-foreground px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md">
                    <Download className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span className="flex-1 min-w-0 leading-snug">
                        Install XIRI: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.
                    </span>
                    <button
                        type="button"
                        onClick={handleDismissInstall}
                        aria-label="Dismiss iOS install hint"
                        className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

