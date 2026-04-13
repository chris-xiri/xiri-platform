import * as admin from 'firebase-admin';

export type QueueTaskType = 'GENERATE' | 'SEND' | 'FOLLOW_UP';
export type QueueStatus = 'PENDING' | 'RETRY' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface QueueItem {
    id?: string;
    vendorId?: string;    // For vendor outreach
    leadId?: string;      // For sales lead outreach (company)
    contactId?: string;   // For contact-centric outreach (the person being emailed)
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

/**
 * Atomically claim a task for processing.
 * Uses a Firestore transaction to ensure only one worker processes a task.
 * Returns true if the task was successfully claimed, false if another worker
 * already picked it up (status is no longer PENDING/RETRY).
 */
export async function claimTask(db: admin.firestore.Firestore, taskId: string): Promise<boolean> {
    const ref = db.collection(COLLECTION).doc(taskId);
    try {
        return await db.runTransaction(async (txn) => {
            const snap = await txn.get(ref);
            if (!snap.exists) return false;
            const current = snap.data()!;
            if (current.status !== 'PENDING' && current.status !== 'RETRY') {
                return false; // Already claimed, completed, or cancelled
            }
            txn.update(ref, {
                status: 'IN_PROGRESS',
                claimedAt: new Date(),
            });
            return true;
        });
    } catch {
        return false; // Transaction contention — another worker won
    }
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

/**
 * Cancel all pending/retry tasks for a lead (used on lead dismissal/loss).
 */
export async function cancelLeadTasks(db: admin.firestore.Firestore, leadId: string) {
    const snapshot = await db.collection(COLLECTION)
        .where('leadId', '==', leadId)
        .where('status', 'in', ['PENDING', 'RETRY'])
        .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'CANCELLED', cancelledAt: new Date() });
    });
    await batch.commit();
    return snapshot.size;
}

/**
 * Cancel all Resend-scheduled emails for a lead (Resend Pro native scheduling).
 * Reads scheduledEmailIds from the company/lead doc and calls resend.emails.cancel(id)
 * for each. Clears the scheduledEmailIds array on success.
 *
 * Falls back gracefully if Resend API key is not set or IDs are missing.
 */
export async function cancelLeadScheduledEmails(
    db: admin.firestore.Firestore,
    leadId: string,
    collection: 'companies' | 'leads' = 'companies'
): Promise<number> {
    const { Resend } = await import('resend');
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('[cancelLeadScheduledEmails] RESEND_API_KEY not set — skipping Resend cancellation.');
        return 0;
    }

    const resend = new Resend(apiKey);
    const docRef = db.collection(collection).doc(leadId);
    const snap = await docRef.get();
    const ids: string[] = snap.data()?.scheduledEmailIds || [];

    if (ids.length === 0) return 0;

    let cancelled = 0;
    for (const id of ids) {
        try {
            await resend.emails.cancel(id);
            cancelled++;
            console.log(`[cancelLeadScheduledEmails] Cancelled Resend email ${id} for lead ${leadId}`);
        } catch (err: any) {
            // Already sent or not found — not a fatal error
            console.warn(`[cancelLeadScheduledEmails] Could not cancel ${id}: ${err?.message}`);
        }
    }

    // Clear the array now that we've processed them
    await docRef.update({ scheduledEmailIds: [] });
    return cancelled;
}
