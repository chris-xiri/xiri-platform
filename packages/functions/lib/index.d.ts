import { telegramWebhook, autoApproveVendor, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved } from "./triggers/onVendorApproved";
import { processOutreachQueue } from "./triggers/outreachWorker";
import { onIncomingMessage } from "./triggers/onIncomingMessage";
import { onDocumentUploaded } from "./triggers/onDocumentUploaded";
export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved, processOutreachQueue, onIncomingMessage, onDocumentUploaded };
export declare const generateLeads: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
    sourced: number;
    analysis: import("./utils/types").RecruitmentAnalysisResult;
}>, unknown>;
export declare const clearPipeline: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    message: string;
}>, unknown>;
export declare const runRecruiterAgent: import("firebase-functions/v2/https").HttpsFunction;
export declare const testNotification: import("firebase-functions/v2/https").HttpsFunction;
//# sourceMappingURL=index.d.ts.map