import * as admin from 'firebase-admin';

export type QueueTaskType = 'GENERATE' | 'SEND' | 'FOLLOW_UP';
export type QueueStatus = 'PENDING' | 'RETRY' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface QueueItem {
    id?: string;
    vendorId: string;
    type: QueueTaskType;
    status: QueueStatus;
    scheduledAt: admin.firestore.Timestamp;
    createdAt: admin.firestore.Timestamp;
    retryCount: number;
    error?: string;
    metadata?: any; // e.g. drafts for SEND task, sequence number for FOLLOW_UP
}

const COLLECTION = 'outreach_queue';

export async function enqueueTask(db: admin.firestore.Firestore, task: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount' | 'status'>) {
    return db.collection(COLLECTION).add({
        ...task,
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date() as any
    });
}

export async function fetchPendingTasks(db: admin.firestore.Firestore) {
    const now = admin.firestore.Timestamp.now();

    // Fetch items that are PENDING or RETRY and scheduled time is past
    // NOTE: Requires composite index if we mix filter + sort on different fields extensively.
    // Simple query: Status IN ['PENDING', 'RETRY'] AND scheduledAt <= now

    const snapshot = await db.collection(COLLECTION)
        .where('status', 'in', ['PENDING', 'RETRY'])
        .where('scheduledAt', '<=', now)
        .limit(10) // Process in batches
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueItem));
}

export async function updateTaskStatus(db: admin.firestore.Firestore, taskId: string, status: QueueStatus, updates: Partial<QueueItem> = {}) {
    await db.collection(COLLECTION).doc(taskId).update({
        status,
        ...updates
    });
}

/**
 * Cancel all pending/retry tasks for a vendor (used on unsubscribe/dismiss).
 */
export async function cancelVendorTasks(db: admin.firestore.Firestore, vendorId: string) {
    const snapshot = await db.collection(COLLECTION)
        .where('vendorId', '==', vendorId)
        .where('status', 'in', ['PENDING', 'RETRY'])
        .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'CANCELLED', cancelledAt: new Date() });
    });
    await batch.commit();
    return snapshot.size;
}

