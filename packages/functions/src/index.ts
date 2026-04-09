// ─── Cloud Functions Entry Point ──────────────────────────────────────
// This file is a thin re-export hub. All function implementations
// live in domain-specific files under ./functions/ and ./triggers/.
//
// Adding a new function? Create it in the appropriate domain file
// and add a re-export line here.

// ── Trigger-based functions (Firestore, auth, scheduled) ──
export { onVendorApproved, onVendorCreated } from "./triggers/onVendorApproved";
export { processOutreachQueue } from "./triggers/outreachWorker";
export { onDocumentUploaded } from "./triggers/onDocumentUploaded";
export { sendBookingConfirmation } from "./triggers/sendBookingConfirmation";
export { sendVendorBookingConfirmation } from "./triggers/sendVendorBookingConfirmation";
export { enrichFromWebsite } from "./triggers/enrichFromWebsite";
export { onOnboardingComplete } from "./triggers/onOnboardingComplete";
export { onAwaitingOnboarding, onVendorAdvancedPastOutreach } from "./triggers/dripScheduler";
export { handleUnsubscribe } from "./triggers/handleUnsubscribe";
export { sendOnboardingInvite } from "./triggers/sendOnboardingInvite";
export { sendQuoteEmail, respondToQuote } from "./triggers/sendQuoteEmail";
export { processMailQueue } from "./triggers/processMailQueue";
export { onWorkOrderAssigned } from "./triggers/onVendorReady";
export { onLeadQualified } from "./triggers/onLeadQualified";
export { onQuoteAccepted, onInvoicePaid, onWorkOrderHandoff, onClientCancelled } from "./triggers/commissionTriggers";
export { processCommissionPayouts, calculateNrr } from "./triggers/commissionScheduled";
export { onAuditSubmitted } from "./triggers/onAuditSubmitted";
export { onReferralLeadWritten } from "./triggers/referralPartnerNotifications";
export { onAuditFailed } from "./triggers/onAuditFailed";
export { generateMonthlyInvoices } from "./triggers/generateMonthlyInvoices";
export { resendWebhook } from "./triggers/resendWebhook";
export { onLeadUpdated, onVendorUpdated, onStaffUpdated } from "./triggers/onLeadUpdated";
export { weeklyTemplateOptimizer, optimizeTemplate } from "./triggers/aiTemplateOptimizer";
export { startLeadSequence } from "./triggers/startLeadSequence";
export { sendSingleLeadEmail } from "./triggers/sendSingleLeadEmail";
export { onContactDeleted } from "./triggers/onContactDeleted";

// ── Social AI Engine (scheduled) ──
export { runSocialContentGenerator } from "./triggers/socialContentGenerator";
export { runSocialPublisher } from "./triggers/socialPublisher";

// ── Auth functions (onCall) ──
export { adminUpdateAuthUser, adminCreateUser, changeMyPassword } from "./functions/auth";

// ── Lead & Vendor sourcing (onCall / onRequest) ──
export { generateLeads, clearPipeline, runRecruiterAgent, testSendEmail, sourceProperties } from "./functions/leads";

// ── Social / Facebook (onCall) ──
export {
    publishFacebookPost,
    getFacebookPosts,
    getFacebookReels,
    deleteFacebookPost,
    triggerSocialContentGeneration,
    updateSocialConfig,
    reviewSocialPost,
    publishPostNow,
    searchPlaces,
    regeneratePostImage,
    regeneratePostCaption,
    getOutroPreview,
} from "./functions/social";

// ── NFC Site Key & Session (onCall) ──
export { validateSiteKey, updateZoneScan, completeNfcSession, getComplianceLog } from "./functions/nfc";

// ── NFC Monitoring & Morning Reports (scheduled + onCall) ──
export { checkNightlyStatus, generateMorningReports, sendTestMorningReport } from "./functions/monitoring";

// ── AI SEO Monitoring (weekly bot digest → Google Chat) ──
export { weeklyAIBotDigest } from "./functions/aiSeoMonitoring";

// ── Clarity UX Analysis (scheduled + onCall) ──
export { dailyClarityReport, triggerClarityReport } from "./triggers/clarityAnalysis";

// ── TidyCal Scheduling Integration (onRequest + onCall) ──
export {
    getOnboardingTimeslots,
    bookOnboardingCall,
    getDashboardTimeslots,
    bookDiscoveryCall,
    getTidyCalBookings,
} from "./functions/tidycal-api";

// ── Lead Prospecting & Enrichment (onCall + scheduled) ──
export { runProspector, addProspectsToCrm } from "./functions/prospecting";
export { dailyProspector, triggerDailyProspector, updateProspectingConfig, getProspectingConfig } from "./triggers/dailyProspector";

// ── AI Sequence Generation (onCall) ──
export { generateAISequence } from "./functions/sequenceGenerator";
