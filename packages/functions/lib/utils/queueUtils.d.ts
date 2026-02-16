import * as admin from 'firebase-admin';
export type QueueTaskType = 'GENERATE' | 'SEND';
export type QueueStatus = 'PENDING' | 'RETRY' | 'COMPLETED' | 'FAILED';
export interface QueueItem {
    id?: string;
    vendorId: string;
    type: QueueTaskType;
    status: QueueStatus;
    scheduledAt: admin.firestore.Timestamp;
    createdAt: admin.firestore.Timestamp;
    retryCount: number;
    error?: string;
    metadata?: any;
}
export declare function enqueueTask(db: admin.firestore.Firestore, task: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<admin.firestore.DocumentReference<admin.firestore.DocumentData, admin.firestore.DocumentData>>;
export declare function fetchPendingTasks(db: admin.firestore.Firestore): Promise<QueueItem[]>;
export declare function updateTaskStatus(db: admin.firestore.Firestore, taskId: string, status: QueueStatus, updates?: Partial<QueueItem>): Promise<void>;
//# sourceMappingURL=queueUtils.d.ts.map