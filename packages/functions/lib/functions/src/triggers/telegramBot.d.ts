export declare const notifyHumanReview: (vendorId: string) => Promise<void>;
export declare const telegramWebhook: import("firebase-functions/v2/https").HttpsFunction;
export declare const autoApproveVendor: import("firebase-functions/v2/https").HttpsFunction;
export declare const onVendorCreated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    vendorId: string;
}>>;
//# sourceMappingURL=telegramBot.d.ts.map