"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueTask = enqueueTask;
exports.fetchPendingTasks = fetchPendingTasks;
exports.updateTaskStatus = updateTaskStatus;
const admin = __importStar(require("firebase-admin"));
const COLLECTION = 'outreach_queue';
async function enqueueTask(db, task) {
    return db.collection(COLLECTION).add({
        ...task,
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date()
    });
}
async function fetchPendingTasks(db) {
    const now = admin.firestore.Timestamp.now();
    // Fetch items that are PENDING or RETRY and scheduled time is past
    // NOTE: Requires composite index if we mix filter + sort on different fields extensively.
    // Simple query: Status IN ['PENDING', 'RETRY'] AND scheduledAt <= now
    const snapshot = await db.collection(COLLECTION)
        .where('status', 'in', ['PENDING', 'RETRY'])
        .where('scheduledAt', '<=', now)
        .limit(10) // Process in batches
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function updateTaskStatus(db, taskId, status, updates = {}) {
    await db.collection(COLLECTION).doc(taskId).update({
        status,
        ...updates
    });
}
//# sourceMappingURL=queueUtils.js.map