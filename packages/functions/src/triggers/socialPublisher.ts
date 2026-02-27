/**
 * Social Publisher
 * Runs on a schedule, finds approved posts whose scheduledFor time has passed,
 * and publishes them to Facebook via the Graph API.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../utils/firebase";
import { publishPost } from "../utils/facebookApi";

/**
 * Find posts due for publishing:
 * - "approved" posts past their scheduledFor time
 * - "draft" posts past their scheduledFor (auto-publish: review window expired)
 */
export async function publishScheduledPosts(): Promise<void> {
    console.log("[SocialPublisher] Checking for posts to publish...");

    const now = new Date();

    // Get both approved AND unreviewed drafts past their deadline
    const duePosts = await db.collection("social_posts")
        .where("status", "in", ["approved", "draft"])
        .where("scheduledFor", "<=", now)
        .limit(5)
        .get();

    if (duePosts.empty) {
        console.log("[SocialPublisher] No posts due for publishing.");
        return;
    }

    console.log(`[SocialPublisher] Found ${duePosts.size} post(s) to publish.`);

    for (const doc of duePosts.docs) {
        const post = doc.data();
        const wasAutoPublished = post.status === "draft"; // Not reviewed by the human

        try {
            const result = await publishPost(
                post.message,
                post.link || undefined,
                post.imageUrl || undefined
            );

            if (result.success) {
                await doc.ref.update({
                    status: "published",
                    facebookPostId: result.id,
                    postUrl: result.postUrl || null,
                    publishedAt: new Date(),
                    autoPublished: wasAutoPublished,
                });
                console.log(`[SocialPublisher] ${wasAutoPublished ? "AUTO-" : ""}Published post ${doc.id} -> FB ID: ${result.id}`);
            } else {
                await doc.ref.update({
                    status: "failed",
                    error: result.error || "Unknown publishing error",
                    failedAt: new Date(),
                });
                console.error(`[SocialPublisher] Failed to publish ${doc.id}: ${result.error}`);
            }
        } catch (error: any) {
            console.error(`[SocialPublisher] Error publishing ${doc.id}:`, error);
            await doc.ref.update({
                status: "failed",
                error: error.message || "Unexpected error",
                failedAt: new Date(),
            });
        }
    }
}

// Scheduled export: Runs every 30 min to publish approved posts
export const runSocialPublisher = onSchedule({
    schedule: "every 30 minutes",
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
}, async () => {
    await publishScheduledPosts();
});
