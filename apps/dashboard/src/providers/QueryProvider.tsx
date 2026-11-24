'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/persistence';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PERSISTED_ENTRIES = 40;

interface PersistedQueryEntry {
    queryKey: readonly unknown[];
    data: unknown;
    dataUpdatedAt: number;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,       // 5 min — sourcing/CRM data doesn't change every second
                        gcTime: 30 * 60 * 1000,         // 30 min in-memory retention across route switches
                        retry: 1,                        // 1 retry on failure
                        refetchOnWindowFocus: false,     // don't spam APIs on tab switch
                    },
                },
            })
    );

    // Hydrate cached queries from localStorage on mount & persist updates
    useEffect(() => {
        const now = Date.now();
        const saved = readStorage<PersistedQueryEntry[]>(STORAGE_KEYS.QUERY_CACHE, []);
        for (const entry of saved) {
            if (
                Array.isArray(entry.queryKey) &&
                typeof entry.dataUpdatedAt === 'number' &&
                now - entry.dataUpdatedAt < CACHE_TTL_MS
            ) {
                queryClient.setQueryData(entry.queryKey, entry.data, {
                    updatedAt: entry.dataUpdatedAt,
                });
            }
        }

        let timer: ReturnType<typeof setTimeout> | null = null;
        const persistSnapshot = () => {
            const queries = queryClient
                .getQueryCache()
                .getAll()
                .filter(
                    (q) =>
                        q.state.status === 'success' &&
                        q.state.data !== undefined &&
                        Date.now() - q.state.dataUpdatedAt < CACHE_TTL_MS
                )
                .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
                .slice(0, MAX_PERSISTED_ENTRIES)
                .map((q) => ({
                    queryKey: q.queryKey,
                    data: q.state.data,
                    dataUpdatedAt: q.state.dataUpdatedAt,
                }));

            writeStorage(STORAGE_KEYS.QUERY_CACHE, queries);
        };

        const unsubscribe = queryClient.getQueryCache().subscribe(() => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(persistSnapshot, 1000);
        });

        return () => {
            unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
