import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./utils/firebase";
import { analyzeVendorLeads } from "./agents/recruiter";
import { searchVendors } from "./agents/sourcer";
import { searchProperties } from "./agents/propertySourcer";
// import { telegramWebhook, autoApproveVendor, notifyHumanReview, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved, onVendorCreated } from "./triggers/onVendorApproved";
import { processOutreachQueue } from "./triggers/outreachWorker";
import { onIncomingMessage } from "./triggers/onIncomingMessage";
import { onDocumentUploaded } from "./triggers/onDocumentUploaded";
import { sendBookingConfirmation } from "./triggers/sendBookingConfirmation";
import { enrichFromWebsite } from "./triggers/enrichFromWebsite";
import { onOnboardingComplete } from "./triggers/onOnboardingComplete";
import { onAwaitingOnboarding } from "./triggers/dripScheduler";
import { handleUnsubscribe } from "./triggers/handleUnsubscribe";
import { sendOnboardingInvite } from "./triggers/sendOnboardingInvite";
import { sendQuoteEmail, respondToQuote } from "./triggers/sendQuoteEmail";
import { processMailQueue } from "./triggers/processMailQueue";
import { onWorkOrderAssigned } from "./triggers/onVendorReady";
import { onLeadQualified } from "./triggers/onLeadQualified";
import { onQuoteAccepted, onInvoicePaid, onWorkOrderHandoff, onClientCancelled } from "./triggers/commissionTriggers";
import { processCommissionPayouts, calculateNrr } from "./triggers/commissionScheduled";
import { onAuditSubmitted } from "./triggers/onAuditSubmitted";
import { onAuditFailed } from "./triggers/onAuditFailed";
import { generateMonthlyInvoices } from "./triggers/generateMonthlyInvoices";
import { resendWebhook } from "./triggers/resendWebhook";
import { onLeadUpdated, onVendorUpdated, onStaffUpdated } from "./triggers/onLeadUpdated";
import { weeklyTemplateOptimizer, optimizeTemplate } from "./triggers/aiTemplateOptimizer";

// Export Bot Functions (Telegram disabled for now)
// export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved, processOutreachQueue, onIncomingMessage, onDocumentUploaded };
export { onVendorApproved, onVendorCreated, processOutreachQueue, onIncomingMessage, onDocumentUploaded, sendBookingConfirmation, enrichFromWebsite, onOnboardingComplete, onAwaitingOnboarding, handleUnsubscribe, sendOnboardingInvite, sendQuoteEmail, respondToQuote, processMailQueue, onWorkOrderAssigned, onLeadQualified, onQuoteAccepted, onInvoicePaid, onWorkOrderHandoff, onClientCancelled, processCommissionPayouts, calculateNrr, onAuditSubmitted, onAuditFailed, generateMonthlyInvoices, resendWebhook, onLeadUpdated, onVendorUpdated, onStaffUpdated, weeklyTemplateOptimizer, optimizeTemplate };

// ─── Admin: Sync Auth Email/Password ─────────────────────────────────────────
import { getAuth } from "firebase-admin/auth";

const DASHBOARD_CORS = [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai",
    "https://app.xiri.ai",
    "https://xiri-dashboard.vercel.app",
    "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app",
    /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
    "https://xiri-facility-solutions.web.app",
    "https://xiri-facility-solutions.firebaseapp.com"
];

/**
 * Admin-only: update a user's email and/or password in Firebase Auth
 * Called from admin user management when editing a user
 */
export const adminUpdateAuthUser = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    // Verify caller is admin
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerRoles = callerDoc.data()?.roles || [];
    if (!callerRoles.includes("admin")) throw new HttpsError("permission-denied", "Admin only");

    const { uid, email, password, displayName } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required");

    const updatePayload: Record<string, string> = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;
    if (displayName) updatePayload.displayName = displayName;

    if (Object.keys(updatePayload).length === 0) {
        throw new HttpsError("invalid-argument", "Nothing to update");
    }

    try {
        await getAuth().updateUser(uid, updatePayload);
        return { success: true, message: `Auth updated for ${uid}` };
    } catch (error: any) {
        console.error("adminUpdateAuthUser error:", error);
        throw new HttpsError("internal", error.message || "Failed to update Auth user");
    }
});

/**
 * Self-service: any authenticated user can change their own password
 */
export const changeMyPassword = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { newPassword } = request.data;
    if (!newPassword || newPassword.length < 6) {
        throw new HttpsError("invalid-argument", "Password must be at least 6 characters");
    }

    try {
        await getAuth().updateUser(request.auth.uid, { password: newPassword });
        return { success: true, message: "Password updated" };
    } catch (error: any) {
        console.error("changeMyPassword error:", error);
        throw new HttpsError("internal", error.message || "Failed to change password");
    }
});

// 1. Lead Sourcing Agent Trigger
export const generateLeads = onCall({
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY"],
    cors: [
        "http://localhost:3001", // Dashboard Dev
        "http://localhost:3000", // Public Site Dev
        "https://xiri.ai", // Public Site Production
        "https://www.xiri.ai", // Public Site WWW
        "https://app.xiri.ai", // Dashboard Production
        "https://xiri-dashboard.vercel.app", // Dashboard Vercel
        "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app", // Vercel develop branch
        /https:\/\/xiri-dashboard-.*\.vercel\.app$/, // All Vercel preview deployments
        "https://xiri-facility-solutions.web.app", // Firebase Hosting
        "https://xiri-facility-solutions.firebaseapp.com"
    ],
    timeoutSeconds: 540
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false; // Default to false (Building Supply)
    const previewOnly = data.previewOnly || false; // Preview mode: don't save to Firestore
    const provider = data.provider || 'google_maps'; // google_maps | nyc_open_data | all
    const dcaCategory = data.dcaCategory;

    if ((provider === 'google_maps' && !query) || !location) {
        throw new HttpsError("invalid-argument", "Missing required fields in request.");
    }

    try {
        console.log(`Analyzing leads for query: ${query}, location: ${location}, provider: ${provider}, category: ${dcaCategory}${previewOnly ? ' (PREVIEW MODE)' : ''}`);

        // 1. Source Leads (provider determines data source)
        const rawVendors = await searchVendors(query, location, provider, dcaCategory);
        console.log(`Sourced ${rawVendors.length} vendors from ${provider}.`);

        // 2. Analyze & Qualify (Recruiter Agent)
        // When previewOnly=true, vendors are NOT saved to Firestore
        const result = await analyzeVendorLeads(rawVendors, query, hasActiveContract, previewOnly);

        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result,
            // Include vendor data in response for preview mode
            vendors: previewOnly ? result.vendors : undefined
        };
    } catch (error: any) {
        console.error("Error in generateLeads:", error);
        throw new HttpsError("internal", error.message || "An internal error occurred.");
    }
});

// 2. Clear Pipeline Tool
export const clearPipeline = onCall({
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app"
    ]
}, async (request) => {
    try {
        const snapshot = await db.collection('vendors').get();

        if (snapshot.empty) {
            return { message: "Pipeline already empty." };
        }

        // Firestore batch max is 500. If we have more, we need multiple batches.
        // For safe deletion, we'll do chunks of 500.
        let count = 0;
        const chunks = [];
        let currentBatch = db.batch(); // We can't reuse the outer batch easily if we chunk

        snapshot.docs.forEach((doc, index) => {
            currentBatch.delete(doc.ref);
            count++;
            if (count % 400 === 0) {
                chunks.push(currentBatch.commit());
                currentBatch = db.batch();
            }
        });

        chunks.push(currentBatch.commit());
        await Promise.all(chunks);

        return { message: `Cleared ${count} vendors from pipeline.` };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

// Test Function to manually trigger recruiter agent
export const runRecruiterAgent = onRequest({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
    // Mock data for testing
    const rawVendors = req.body.vendors || [
        { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
        { name: "Joe's Pizza", services: "Best pizza in town" },
        { name: "Elite HVAC", services: "Commercial HVAC systems" }
    ];

    const result = await analyzeVendorLeads(rawVendors, "Commercial Cleaning");
    res.json(result);
});


// Test Function to manually trigger notification (Telegram disabled for now)
/* export const testNotification = onRequest(async (req, res) => {
    const vendorId = req.query.vendorId as any;
    if (vendorId) {
        await notifyHumanReview(vendorId);
        res.send(`Notification sent for ${vendorId}`);
    } else {
        res.status(400).send("Provide vendorId query param");
    }
}); */

export const testSendEmail = onCall({
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app"
    ]
}, async (request) => {
    const { sendTemplatedEmail } = await import("./utils/emailUtils");
    const { vendorId, templateId } = request.data;

    if (!vendorId || !templateId) {
        throw new HttpsError("invalid-argument", "Missing vendorId or templateId");
    }

    try {
        await sendTemplatedEmail(vendorId, templateId);
        return { success: true, message: `Email sent to vendor ${vendorId}` };
    } catch (error: any) {
        console.error("Error sending test email:", error);
        throw new HttpsError("internal", error.message || "Failed to send email");
    }
});

// ── Property Sourcing Agent ──
export const sourceProperties = onCall({
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app",
        /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
        "https://xiri-facility-solutions.web.app",
        "https://xiri-facility-solutions.firebaseapp.com"
    ],
    timeoutSeconds: 120
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const providerName = data.provider || 'mock';

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
    }

    try {
        console.log(`[sourceProperties] query="${query}", location="${location}", provider=${providerName}`);
        const properties = await searchProperties(query, location, providerName);

        return {
            message: 'Property sourcing completed.',
            sourced: properties.length,
            properties,
        };
    } catch (error: any) {
        console.error('[sourceProperties] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to source properties.');
    }
});

// ── Facebook Page Management ──
import { publishPost, schedulePost, getRecentPosts, getPageInsights, deletePost } from "./utils/facebookApi";

export const publishFacebookPost = onCall({
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { message, link, imageUrl, scheduledTime } = request.data;

    if (!message) {
        throw new HttpsError("invalid-argument", "Message is required");
    }

    try {
        let result;
        if (scheduledTime) {
            result = await schedulePost(message, new Date(scheduledTime), link);
            console.log(`[Facebook] Scheduled post for ${scheduledTime}:`, result);
        } else {
            result = await publishPost(message, link, imageUrl);
            console.log(`[Facebook] Published post:`, result);
        }

        // Log to Firestore for tracking
        await db.collection('social_posts').add({
            platform: 'facebook',
            message,
            link: link || null,
            imageUrl: imageUrl || null,
            scheduledTime: scheduledTime || null,
            facebookPostId: result.id,
            postUrl: result.postUrl || null,
            success: result.success,
            error: result.error || null,
            postedBy: request.auth.uid,
            createdAt: new Date(),
        });

        return result;
    } catch (error: any) {
        console.error("[Facebook] Publish error:", error);
        throw new HttpsError("internal", error.message || "Failed to publish to Facebook");
    }
});

export const getFacebookPosts = onCall({
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { limit } = request.data || {};

    try {
        const posts = await getRecentPosts(limit || 10);
        const insights = await getPageInsights("week");

        return { posts, insights };
    } catch (error: any) {
        console.error("[Facebook] Get posts error:", error);
        throw new HttpsError("internal", error.message || "Failed to get Facebook posts");
    }
});

export const deleteFacebookPost = onCall({
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { postId } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required");

    try {
        const success = await deletePost(postId);

        // Update tracking record
        const snapshot = await db.collection('social_posts')
            .where('facebookPostId', '==', postId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                deleted: true,
                deletedAt: new Date(),
                deletedBy: request.auth.uid,
            });
        }

        return { success };
    } catch (error: any) {
        console.error("[Facebook] Delete error:", error);
        throw new HttpsError("internal", error.message || "Failed to delete Facebook post");
    }
});

// ── Social Media AI Engine ──
import { runSocialContentGenerator, generateSocialContent } from "./triggers/socialContentGenerator";
import { runSocialPublisher } from "./triggers/socialPublisher";

export { runSocialContentGenerator, runSocialPublisher };

// Manual trigger to generate content now (for testing)
export const triggerSocialContentGeneration = onCall({
    secrets: ["GEMINI_API_KEY", "FACEBOOK_PAGE_ACCESS_TOKEN"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 540,
    memory: "1GiB",
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    const channel = request.data?.channel || "facebook_posts";
    await generateSocialContent(channel);
    return { success: true };
});

// Update social config (cadence, tone, topics, etc.)
export const updateSocialConfig = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { channel, cadence, preferredDays, preferredTime, tone, topics, hashtagSets, enabled, audienceMix } = request.data;
    const channelId = channel || "facebook_posts";

    const config: Record<string, any> = { updatedAt: new Date() };
    if (cadence !== undefined) config.cadence = cadence;
    if (preferredDays !== undefined) config.preferredDays = preferredDays;
    if (preferredTime !== undefined) config.preferredTime = preferredTime;
    if (tone !== undefined) config.tone = tone;
    if (topics !== undefined) config.topics = topics;
    if (hashtagSets !== undefined) config.hashtagSets = hashtagSets;
    if (enabled !== undefined) config.enabled = enabled;
    if (audienceMix !== undefined) config.audienceMix = audienceMix;
    config.platform = channelId.startsWith("facebook") ? "facebook" : "linkedin";

    await db.collection("social_config").doc(channelId).set(config, { merge: true });
    console.log(`[Social] Config updated for ${channelId}:`, config);

    return { success: true };
});

// Review (approve/reject/edit) a social post draft
export const reviewSocialPost = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { postId, action, editedMessage, rejectionReason, scheduledFor } = request.data;

    if (!postId || !action) {
        throw new HttpsError("invalid-argument", "postId and action are required");
    }

    const postRef = db.collection("social_posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
        throw new HttpsError("not-found", "Post not found");
    }

    const update: Record<string, any> = {
        reviewedBy: request.auth.uid,
        reviewedAt: new Date(),
    };

    switch (action) {
        case "approve":
            update.status = "approved";
            if (editedMessage) update.message = editedMessage;
            if (scheduledFor) update.scheduledFor = new Date(scheduledFor);
            break;
        case "reject":
            update.status = "rejected";
            update.rejectionReason = rejectionReason || null;
            break;
        default:
            throw new HttpsError("invalid-argument", "action must be 'approve' or 'reject'");
    }

    await postRef.update(update);
    console.log(`[Social] Post ${postId} ${action}ed by ${request.auth.uid}`);

    return { success: true, status: update.status };
});
