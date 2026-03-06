import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { getPrompt } from "../utils/promptUtils";
import { DASHBOARD_CORS } from "../utils/cors";
import { publishPost, publishReel, searchFacebookPlaces, schedulePost, getRecentPosts, getPageInsights, deletePost } from "../utils/facebookApi";
import { generateSocialContent } from "../triggers/socialContentGenerator";

// ── Publish Facebook Post ──
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

// ── Get Facebook Posts ──
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

// ── Get Facebook Reels ──
export const getFacebookReels = onCall({
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { limit } = request.data || {};

    try {
        const { getRecentReels } = await import("../utils/facebookApi");
        const reels = await getRecentReels(limit || 10);
        return { reels };
    } catch (error: any) {
        console.error("[Facebook] Get reels error:", error);
        throw new HttpsError("internal", error.message || "Failed to get Facebook reels");
    }
});

// ── Delete Facebook Post ──
export const deleteFacebookPost = onCall({
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { postId } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required");

    try {
        const success = await deletePost(postId);

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

// ── Trigger Social Content Generation ──
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

// ── Update Social Config ──
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

// ── Review Social Post ──
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

// ── Publish Post Now ──
export const publishPostNow = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
    timeoutSeconds: 180,
    memory: "512MiB",
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { postId } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required");

    const postRef = db.collection("social_posts").doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) throw new HttpsError("not-found", "Post not found");

    const post = postDoc.data()!;

    try {
        let result;

        if (post.channel === "facebook_reels" && post.videoUrl) {
            console.log(`[PublishNow] Publishing reel ${postId}...`);

            let finalVideoUrl = post.videoUrl;
            const outroPresetId = post.outroPresetId;
            if (outroPresetId) {
                try {
                    const { generateOutroFrame } = await import("../utils/reelOutroGenerator");
                    const { writeFileSync, unlinkSync, existsSync } = await import("fs");
                    const { execSync } = await import("child_process");
                    const path = await import("path");
                    const os = await import("os");

                    const tmpDir = os.tmpdir();
                    const outroPng = path.join(tmpDir, `outro-${postId}.png`);
                    const outroMp4 = path.join(tmpDir, `outro-${postId}.mp4`);
                    const originalMp4 = path.join(tmpDir, `original-${postId}.mp4`);
                    const concatList = path.join(tmpDir, `concat-${postId}.txt`);
                    const finalMp4 = path.join(tmpDir, `final-${postId}.mp4`);

                    const outroPngBuffer = await generateOutroFrame(outroPresetId);
                    writeFileSync(outroPng, outroPngBuffer);

                    const videoResp = await fetch(post.videoUrl);
                    const videoArrayBuf = await videoResp.arrayBuffer();
                    writeFileSync(originalMp4, Buffer.from(videoArrayBuf));

                    execSync(
                        `ffmpeg -y -loop 1 -i "${outroPng}" -c:v libx264 -t 3 -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -r 30 "${outroMp4}"`,
                        { timeout: 30000 }
                    );

                    const normalizedMp4 = path.join(tmpDir, `norm-${postId}.mp4`);
                    execSync(
                        `ffmpeg -y -i "${originalMp4}" -c:v libx264 -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -r 30 -an "${normalizedMp4}"`,
                        { timeout: 60000 }
                    );

                    writeFileSync(concatList, `file '${normalizedMp4}'\nfile '${outroMp4}'\n`);
                    execSync(
                        `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${finalMp4}"`,
                        { timeout: 30000 }
                    );

                    const { readFileSync } = await import("fs");
                    const finalBuffer = readFileSync(finalMp4);
                    const storageBucket = (await import("firebase-admin/storage")).getStorage().bucket();
                    const fileName = `social-videos/reel-${postId}-with-outro.mp4`;
                    const file = storageBucket.file(fileName);
                    await file.save(finalBuffer, { metadata: { contentType: "video/mp4" } });
                    await file.makePublic();
                    finalVideoUrl = `https://storage.googleapis.com/${storageBucket.name}/${fileName}`;

                    console.log(`[PublishNow] Outro appended, final video: ${finalVideoUrl}`);

                    [outroPng, outroMp4, originalMp4, normalizedMp4, concatList, finalMp4].forEach(f => {
                        if (existsSync(f)) unlinkSync(f);
                    });
                } catch (outroErr: any) {
                    console.error(`[PublishNow] Outro append failed (publishing without):`, outroErr.message);
                }
            }

            result = await publishReel(
                finalVideoUrl,
                post.message || "",
                post.facebookPlaceId || undefined,
            );
        } else {
            console.log(`[PublishNow] Publishing post ${postId}...`);
            result = await publishPost(
                post.message,
                post.link || undefined,
                post.imageUrl || undefined,
                post.facebookPlaceId || undefined,
            );
        }

        if (result.success) {
            await postRef.update({
                status: "published",
                facebookPostId: result.id,
                postUrl: result.postUrl || null,
                publishedAt: new Date(),
                publishedBy: request.auth.uid,
            });
            console.log(`[PublishNow] Published ${postId} -> FB ID: ${result.id}`);
            return { success: true, postUrl: result.postUrl };
        } else {
            await postRef.update({
                status: "failed",
                error: result.error || "Publishing failed",
                failedAt: new Date(),
            });
            throw new HttpsError("internal", result.error || "Publishing failed");
        }
    } catch (err: any) {
        const errorMsg = err.message || "Publishing failed";
        console.error(`[PublishNow] Error:`, errorMsg);
        await postRef.update({
            status: "failed",
            error: errorMsg,
            failedAt: new Date(),
        }).catch(() => { });
        throw new HttpsError("internal", errorMsg);
    }
});

// ── Search Facebook Places ──
export const searchPlaces = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["FACEBOOK_PAGE_ACCESS_TOKEN"],
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { query } = request.data;
    if (!query) throw new HttpsError("invalid-argument", "query is required");

    const results = await searchFacebookPlaces(query);
    return { places: results };
});

// ── Regenerate Post Image ──
export const regeneratePostImage = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 300,
    memory: "1GiB",
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { postId, feedback } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required");

    const postRef = db.collection("social_posts").doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) throw new HttpsError("not-found", "Post not found");

    const post = postDoc.data()!;
    const audience = (post.audience || "contractor") as "client" | "contractor";

    console.log(`[RegenImage] Regenerating image for post ${postId} with feedback: "${feedback || "none"}"`);

    const { generatePostImage } = await import("../utils/imagenApi");
    const result = await generatePostImage(post.message, audience, feedback || undefined);

    if (!result) {
        throw new HttpsError("internal", "Image generation failed");
    }

    await postRef.update({
        imageUrl: result.imageUrl,
        imageRegenCount: (post.imageRegenCount || 0) + 1,
        lastImageFeedback: feedback || null,
    });

    console.log(`[RegenImage] New image: ${result.imageUrl}`);
    return { success: true, imageUrl: result.imageUrl };
});

// ── Regenerate Post Caption ──
export const regeneratePostCaption = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { postId, feedback } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required");

    const postRef = db.collection("social_posts").doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) throw new HttpsError("not-found", "Post not found");

    const post = postDoc.data()!;
    const audience = post.audience === "client" ? "FACILITY CLIENTS" : "CONTRACTORS/VENDORS";

    console.log(`[RegenCaption] Regenerating caption for post ${postId} with feedback: "${feedback || "none"}"`);

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const API_KEY = process.env.GEMINI_API_KEY || "";
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const FALLBACK = `You are the social media manager for XIRI Facility Solutions. You previously generated this Facebook post for {{audience}}:

--- CURRENT POST ---
{{currentPost}}
--- END ---

The reviewer has provided this feedback:
"{{feedback}}"

Write an improved version of this post incorporating the feedback. Keep the same target audience ({{audience}}).

CRITICAL FORMATTING RULES:
- Facebook does NOT support text formatting. Do NOT use Markdown.
- NEVER use asterisks (*), double asterisks (**), underscores for emphasis, or any Markdown syntax.
- Write XIRI in plain uppercase text, never **XIRI** or *XIRI*.
- Use emoji as visual bullets, not asterisks.
- Include relevant hashtags at the end.
- 100-250 words.

Respond with ONLY the post text. No introductions.`;

    const prompt = await getPrompt('social_caption_regenerator', FALLBACK, {
        audience,
        currentPost: post.message,
        feedback: feedback || 'Generate a different version',
    });

    const result = await model.generateContent(prompt);
    const newCaption = result.response.text().trim();

    if (!newCaption) {
        throw new HttpsError("internal", "Caption generation returned empty");
    }

    await postRef.update({
        message: newCaption,
        captionRegenCount: (post.captionRegenCount || 0) + 1,
        lastCaptionFeedback: feedback || null,
    });

    console.log(`[RegenCaption] New caption generated (${newCaption.length} chars)`);
    return { success: true, message: newCaption };
});

// ── Get Outro Preview Image ──
export const getOutroPreview = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { presetId } = request.data;
    if (!presetId) throw new HttpsError("invalid-argument", "presetId is required");

    const { getOrCreateOutroFrameUrl } = await import("../utils/reelOutroGenerator");
    const url = await getOrCreateOutroFrameUrl(presetId);
    return { url };
});
