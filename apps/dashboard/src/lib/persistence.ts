'use client';

const STORAGE_PREFIX = 'xiri:';

export const STORAGE_KEYS = {
    LAST_ROUTE: 'last-route',
    SIDEBAR_COLLAPSED: 'sidebar-collapsed',
    SIDEBAR_SECTIONS: 'sidebar-sections',
    INSTALL_DISMISSED: 'pwa-install-dismissed',
    QUERY_CACHE: 'query-cache-v1',
} as const;

const RESTORABLE_ROUTE_PREFIXES = [
    '/sales/',
    '/supply/',
    '/operations/',
    '/accounting/',
    '/admin/',
];

export function readStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeStorage<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
        // Ignore quota / private-mode storage errors
    }
}

export function isRestorableRoute(pathname: string | null | undefined): pathname is string {
    if (!pathname) return false;
    if (pathname === '/admin/pricing') return false;
    return RESTORABLE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function saveLastRoute(pathname: string): void {
    if (!isRestorableRoute(pathname)) return;
    writeStorage(STORAGE_KEYS.LAST_ROUTE, pathname);
}

export function getLastRoute(): string | null {
    const saved = readStorage<string | null>(STORAGE_KEYS.LAST_ROUTE, null);
    return isRestorableRoute(saved) ? saved : null;
}

