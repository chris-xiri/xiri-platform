'use client';

/**
 * Reusable Firestore query hooks powered by TanStack Query.
 *
 * Usage:
 *   const { data, isLoading, error } = useFirestoreQuery('leads', leadsQuery);
 *   const { data, isLoading } = useFirestoreDoc('leads', leadId);
 *
 * Benefits over raw useEffect + getDocs:
 *   - Automatic caching (5-min stale time)
 *   - Request deduplication (multiple components querying same collection = 1 Firestore read)
 *   - Automatic retry on failure
 *   - Loading/error states built-in
 *   - Cache invalidation via queryClient.invalidateQueries(['leads'])
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    type Query,
    type DocumentData,
    type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Collection Query ──

/**
 * Fetch a Firestore collection query and return the docs as typed objects.
 * The query key is [collectionName, ...extraKeys] for cache scoping.
 *
 * @example
 * const leadsQuery = query(collection(db, 'leads'), where('status', '==', 'open'));
 * const { data: leads, isLoading } = useFirestoreQuery('leads', leadsQuery);
 */
export function useFirestoreQuery<T = DocumentData>(
    queryKey: string | string[],
    firestoreQuery: Query<DocumentData>,
    options?: Omit<UseQueryOptions<T[], Error>, 'queryKey' | 'queryFn'>
) {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];

    return useQuery<T[], Error>({
        queryKey: key,
        queryFn: async () => {
            const snapshot = await getDocs(firestoreQuery);
            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            })) as T[];
        },
        ...options,
    });
}

// ── Single Document ──

/**
 * Fetch a single Firestore document by collection + id.
 *
 * @example
 * const { data: lead, isLoading } = useFirestoreDoc('leads', leadId);
 */
export function useFirestoreDoc<T = DocumentData>(
    collectionName: string,
    documentId: string | undefined | null,
    options?: Omit<UseQueryOptions<T | null, Error>, 'queryKey' | 'queryFn'>
) {
    return useQuery<T | null, Error>({
        queryKey: [collectionName, documentId],
        queryFn: async () => {
            if (!documentId) return null;
            const ref = doc(db, collectionName, documentId) as DocumentReference<DocumentData>;
            const snapshot = await getDoc(ref);
            if (!snapshot.exists()) return null;
            return { id: snapshot.id, ...snapshot.data() } as T;
        },
        enabled: !!documentId,
        ...options,
    });
}
