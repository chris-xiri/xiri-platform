import { telegramWebhook, autoApproveVendor, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved } from "./triggers/onVendorApproved";
export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved };
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