import * as functions from "firebase-functions";
import { telegramWebhook, autoApproveVendor, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved } from "./triggers/outreachTriggers";
export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved };
export declare const generateLeads: functions.https.CallableFunction<any, Promise<{
    message: string;
    sourced: number;
    analysis: import("./utils/types").RecruitmentAnalysisResult;
}>, unknown>;
export declare const runRecruiterAgent: functions.https.HttpsFunction;
export declare const testNotification: functions.https.HttpsFunction;
//# sourceMappingURL=index.d.ts.map