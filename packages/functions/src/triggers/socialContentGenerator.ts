/**
 * AI Social Content Generator
 * Runs on a schedule, fetches Facebook engagement data, 
 * and uses Gemini to generate draft posts for review.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../utils/firebase";
import { getRecentPosts } from "../utils/facebookApi";
import { generatePostImage } from "../utils/imagenApi";
import { generateReelVideo } from "../utils/veoApi";

const API_KEY = process.env.GEMINI_API_KEY || "";

interface SocialConfig {
    platform: string;
    cadence: "daily" | "3x_week" | "2x_week" | "weekly";
    preferredDays: string[];
    preferredTime: string;
    tone: string;
    topics: string[];
    hashtagSets: string[];
    enabled: boolean;
    audienceMix?: {
        client: number;      // percentage 0-100
        contractor: number;  // percentage 0-100
    };
}

const DAY_MAP: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
};

/**
 * Build the Gemini prompt using engagement data and config
 */
function buildPrompt(
    config: SocialConfig,
    engagementSummary: string,
    recentPostSummaries: string[],
    audience: "client" | "contractor",
    campaignContext?: string
): string {
    const audienceContext = audience === "client"
        ? `## TARGET AUDIENCE: FACILITY CLIENTS (Medical Offices, Auto Dealerships, Commercial Buildings)
This post should speak to building owners, office managers, or property managers who are frustrated with:
- Managing multiple vendors, multiple invoices
- Inconsistent cleaning/maintenance quality  
- No accountability or audit trail
- Being the "accidental facility manager"

Key messaging for clients:
- "One call, one invoice" — we handle everything
- Nightly audits verify work quality (not just trust)
- Medical-suite grade standards for every facility  
- We are an extension of THEIR team, not another vendor
- Consolidated billing = no more paperwork chaos`
        : `## TARGET AUDIENCE: INDEPENDENT CONTRACTORS & SUB-CONTRACTORS
This post should speak to cleaning crews, HVAC techs, maintenance workers, and specialty trade professionals looking for:
- Steady, reliable contract work (no chasing leads)
- Fast, predictable pay (10th of every month, no excuses)
- Zero admin/sales hassle — we bring the accounts, you do the work
- No franchise fees, no buy-ins
- Professional support and accountability

Key messaging for contractors:
- We handle the sales, you handle the craft
- Payout on the 10th, every month, guaranteed
- Join a network of pros — not a faceless gig platform
- We value quality work and long-term partnerships
- Currently hiring in Queens, Nassau, Suffolk, Long Island`;

    return `You are the social media manager for XIRI Facility Solutions, a facility management company based in New York that services commercial and medical buildings across Queens, Nassau, and Suffolk County.

## BRAND IDENTITY
- Brand Name: XIRI (always uppercase, never wrapped in asterisks or any formatting)
- Full Name: XIRI Facility Solutions
- Tagline: "One Call. One Invoice. Total Facility Coverage."
- Brand Colors: Primary #0369a1, Accent #38bdf8, Dark #0c4a6e (Sky/Cyan family)
- Visual Style: Professional, bold, clean — industrial-grade but executive-quality
- Tone: Blue-collar-friendly but executive-grade. Never salesy or generic.
- Fonts: Inter (body), Outfit (headings) — clean modern look

## BUSINESS CONTEXT
- XIRI hires independent sub-contractors (cleaning, HVAC, maintenance, specialty trades) to fulfill contracts XIRI holds with medical offices, urgent care clinics, auto dealerships, and commercial facilities.
- For CONTRACTORS: We offer steady contract work, one point of contact, fast payouts (10th of the month), no franchise fees.
- For CLIENTS: We are their single point of contact for all facility maintenance — one call, one invoice, audit-ready standards.
- Website: xiri.ai
- Service Areas: Queens, Nassau County, Suffolk County, Long Island

${audienceContext}
${campaignContext ? `\n## ACTIVE RECRUITMENT CAMPAIGN\n${campaignContext}\n` : ""}
## ENGAGEMENT DATA (Last 20 Posts)
${engagementSummary}

## RECENT POST THEMES (avoid repeating these)
${recentPostSummaries.length > 0 ? recentPostSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n") : "No recent posts yet."}

## CONTENT PREFERENCES
- Tone: ${config.tone || "Professional, bold, blue-collar-friendly but executive-grade"}
- Topics to focus on: ${config.topics.length > 0 ? config.topics.join(", ") : "contractor recruitment, client success, industry tips, behind-the-scenes, company culture"}
- Hashtags to include: ${config.hashtagSets.length > 0 ? config.hashtagSets.join(" ") : "#FacilityManagement #CommercialCleaning #LongIsland #Queens #NYContractors"}

## YOUR TASK
Generate exactly 1 Facebook post for XIRI Facility Solutions targeting ${audience === "client" ? "FACILITY CLIENTS" : "CONTRACTORS/VENDORS"}. The post should:

1. Be formatted for Facebook (use emoji as paragraph-style bullets, not checkmarks)
2. Be 100-250 words
3. Include a clear call-to-action
4. Include relevant hashtags at the end
5. Be different from the recent posts listed above
6. Drive engagement (likes, comments, shares) based on what performed well in the engagement data
7. Be written in a natural, human voice — not corporate jargon

CRITICAL FORMATTING RULES:
- Facebook does NOT support any text formatting. Do NOT use Markdown.
- NEVER use asterisks (*), double asterisks (**), underscores for emphasis, or any other Markdown syntax.
- Use ONLY: emoji, line breaks, and hashtags for visual structure.
- Write the brand name as XIRI in plain text, never **XIRI** or *XIRI*.
- Use emoji at the start of lines as visual bullets (e.g., 👉 💰 🔧), NOT asterisks.
- Separate sections with blank lines for readability.

Respond with ONLY the post text. No introductions, no explanations, just the ready-to-publish Facebook post.`;
}

/**
 * Build Gemini prompt for Reel captions (shorter, punchier, hook-driven)
 */
function buildReelCaptionPrompt(
    config: SocialConfig,
    audience: "client" | "contractor",
    location?: string,
    campaignContext?: string
): string {
    const audienceHook = audience === "client"
        ? `Hook angle: Speak to facility managers / building owners who are tired of managing 5+ vendors.
Key points: one call, one invoice, nightly audits verify quality, medical-grade standards.
CTA: "DM us" or "Link in bio" or "Comment CLEAN for a free site audit"`
        : `Hook angle: Speak to contractors / cleaning crews looking for steady, reliable work.
Key points: guaranteed payout on the 10th, no franchise fees, we handle the sales.
CTA: "DM us" or "Link in bio" or "Comment WORK to get started"`;

    const locationNote = location
        ? `\nMention ${location}, NY naturally — e.g., "Looking for reliable facility management in ${location}?"`
        : `\nMention Long Island / Queens area naturally.`;

    return `You are writing a Facebook Reel caption for XIRI Facility Solutions — a facility management company in New York (Queens, Nassau, Suffolk County).

## BRAND IDENTITY
- Brand Name: XIRI (always uppercase, never wrapped in asterisks or any formatting)
- Tagline: "One Call. One Invoice. Total Facility Coverage."
- Brand Colors: Primary #0369a1 (Sky Blue), Accent #38bdf8
- Tone: Professional, punchy, blue-collar-friendly but executive-grade

## TARGET AUDIENCE: ${audience === "client" ? "FACILITY CLIENTS" : "CONTRACTORS/VENDORS"}
${audienceHook}
${locationNote}
${campaignContext ? `\n## ACTIVE RECRUITMENT CAMPAIGN\n${campaignContext}\n` : ""}

## CONTENT PREFERENCES
- Tone: ${config.tone || "Professional, bold, punchy"}
- Hashtags: ${config.hashtagSets.length > 0 ? config.hashtagSets.join(" ") : "#FacilityManagement #CommercialCleaning #LongIsland"}

## YOUR TASK
Generate a Facebook Reel caption (NOT a full post). A reel caption should be:

1. 2-4 lines MAX — short, punchy, scroll-stopping
2. Start with a hook (question or bold statement)
3. One key value prop
4. Clear CTA
5. Relevant hashtags at the end
6. Use emoji sparingly (1-2 max)
7. Written like a human, not a brand

CRITICAL FORMATTING RULES:
- Facebook does NOT support text formatting. Do NOT use Markdown.
- NEVER use asterisks (*), double asterisks (**), underscores for emphasis, or any Markdown syntax.
- Write XIRI in plain uppercase text, never **XIRI** or *XIRI*.
- Use ONLY: emoji, line breaks, and hashtags.

Example format:
"Still managing 5 different vendors? 🤯
One call. One invoice. Nightly verified.
DM us for a free site audit 👇
#FacilityManagement #LongIsland"

Respond with ONLY the caption text. Nothing else.`;
}

/**
 * Analyze engagement data from recent posts
 */
function summarizeEngagement(posts: any[]): {
    summary: string;
    themes: string[];
    avgLikes: number;
    avgComments: number;
    avgShares: number;
} {
    if (posts.length === 0) {
        return {
            summary: "No previous posts to analyze.",
            themes: [],
            avgLikes: 0,
            avgComments: 0,
            avgShares: 0,
        };
    }

    const totalLikes = posts.reduce(
        (sum: number, p: any) => sum + (p.likes?.summary?.total_count || 0), 0
    );
    const totalComments = posts.reduce(
        (sum: number, p: any) => sum + (p.comments?.summary?.total_count || 0), 0
    );
    const totalShares = posts.reduce(
        (sum: number, p: any) => sum + (p.shares?.count || 0), 0
    );

    const avgLikes = Math.round(totalLikes / posts.length);
    const avgComments = Math.round(totalComments / posts.length);
    const avgShares = Math.round(totalShares / posts.length);

    // Find top performing posts
    const sorted = [...posts].sort((a: any, b: any) => {
        const aScore = (a.likes?.summary?.total_count || 0) + (a.comments?.summary?.total_count || 0) * 3 + (a.shares?.count || 0) * 5;
        const bScore = (b.likes?.summary?.total_count || 0) + (b.comments?.summary?.total_count || 0) * 3 + (b.shares?.count || 0) * 5;
        return bScore - aScore;
    });

    const topPost = sorted[0];
    const topTheme = topPost?.message?.slice(0, 80) || "N/A";

    const themes = posts
        .filter((p: any) => p.message)
        .map((p: any) => p.message!.split("\n")[0].slice(0, 60));

    const summary = `
- Total posts analyzed: ${posts.length}
- Average likes per post: ${avgLikes}
- Average comments per post: ${avgComments}
- Average shares per post: ${avgShares}
- Top performing post theme: "${topTheme}..."
- Best engagement driver: ${avgShares > avgComments ? "Shares" : avgComments > avgLikes ? "Comments" : "Likes"}
    `.trim();

    return { summary, themes, avgLikes, avgComments, avgShares };
}

/**
 * Calculate the next N posting dates based on cadence config
 */
function getNextPostingDates(config: SocialConfig, count: number): Date[] {
    const dates: Date[] = [];
    const [hours, minutes] = (config.preferredTime || "10:00").split(":").map(Number);
    const now = new Date();
    let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // If today's posting time hasn't passed yet, include today
    const todayPost = new Date(cursor.getTime());
    todayPost.setHours(hours, minutes, 0, 0);

    // Start from today if time hasn't passed, otherwise tomorrow
    if (now >= todayPost) {
        cursor.setDate(cursor.getDate() + 1);
    }

    let safety = 0;
    while (dates.length < count && safety < 30) {
        safety++;
        const dayOfWeek = cursor.getDay();

        let isPostingDay = false;
        if (config.cadence === "daily") {
            isPostingDay = true;
        } else {
            isPostingDay = config.preferredDays.some(
                (day) => DAY_MAP[day.toLowerCase()] === dayOfWeek
            );
        }

        if (isPostingDay) {
            const postDate = new Date(cursor.getTime());
            postDate.setHours(hours, minutes, 0, 0);
            dates.push(postDate);
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
}

/**
 * Main function: Ensure 3 upcoming drafts are always queued
 */
export async function generateSocialContent(channel: string = "facebook_posts"): Promise<void> {
    console.log(`[SocialGenerator] Starting content generation for channel: ${channel}...`);

    // 1. Read config (per-channel)
    const configDoc = await db.collection("social_config").doc(channel).get();
    if (!configDoc.exists) {
        // Fallback to legacy "facebook" doc for backward compatibility
        const legacyDoc = await db.collection("social_config").doc("facebook").get();
        if (!legacyDoc.exists) {
            console.log("[SocialGenerator] No social config found. Skipping.");
            return;
        }
        // Migrate legacy config to new channel key
        await db.collection("social_config").doc(channel).set(legacyDoc.data()!);
        console.log(`[SocialGenerator] Migrated legacy config to ${channel}.`);
    }

    const freshConfig = await db.collection("social_config").doc(channel).get();
    const config = freshConfig.data() as SocialConfig;
    if (!config.enabled) {
        console.log("[SocialGenerator] Social posting is disabled. Skipping.");
        return;
    }

    // 2. Get the next 3 posting dates
    const TARGET_QUEUE_SIZE = 3;
    const upcomingDates = getNextPostingDates(config, TARGET_QUEUE_SIZE);
    console.log(`[SocialGenerator] Next ${TARGET_QUEUE_SIZE} posting dates:`, upcomingDates.map(d => d.toISOString()));

    // 3. Check which dates already have drafts for this channel
    const now = new Date();
    const pendingDrafts = await db.collection("social_posts")
        .where("channel", "==", channel)
        .where("status", "in", ["draft", "approved"])
        .where("scheduledFor", ">", now)
        .get();

    const existingScheduledTimes = new Set(
        pendingDrafts.docs.map(d => {
            const sf = d.data().scheduledFor;
            return sf?.toDate ? sf.toDate().toISOString() : new Date(sf).toISOString();
        })
    );

    const datesToGenerate = upcomingDates.filter(
        (d) => !existingScheduledTimes.has(d.toISOString())
    );

    const currentQueueSize = pendingDrafts.size;
    const slotsToFill = Math.max(0, TARGET_QUEUE_SIZE - currentQueueSize);

    if (slotsToFill === 0) {
        console.log(`[SocialGenerator] Queue is full (${currentQueueSize}/${TARGET_QUEUE_SIZE}). Skipping.`);
        return;
    }

    const toGenerate = datesToGenerate.slice(0, slotsToFill);
    if (toGenerate.length === 0) {
        console.log("[SocialGenerator] All upcoming dates already have drafts. Skipping.");
        return;
    }

    // 4. Fetch engagement data once
    console.log("[SocialGenerator] Fetching recent posts for analysis...");
    const recentPosts = await getRecentPosts(20);
    const { summary, themes, avgLikes, avgComments, avgShares } = summarizeEngagement(recentPosts);

    // 5. Determine audience rotation (client vs contractor)
    const mix = config.audienceMix || { client: 50, contractor: 50 };
    const clientRatio = mix.client / (mix.client + mix.contractor);

    // Count existing drafts by audience to maintain balance
    const existingClientDrafts = pendingDrafts.docs.filter(d => d.data().audience === "client").length;
    const existingContractorDrafts = pendingDrafts.docs.filter(d => d.data().audience === "contractor").length;
    const totalExisting = existingClientDrafts + existingContractorDrafts;
    const currentClientRatio = totalExisting > 0 ? existingClientDrafts / totalExisting : 0.5;

    // 5.5 Fetch active campaigns for this channel
    const activeCampaignsSnap = await db.collection("social_campaigns")
        .where("channel", "==", channel)
        .where("status", "==", "active")
        .get();

    const activeCampaigns: any[] = activeCampaignsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 6. Generate content for each missing slot
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const isReels = channel === "facebook_reels";

    let slotIndex = 0;
    for (const scheduledFor of toGenerate) {
        try {
            // Check if there is an active campaign for this date
            const campaign = activeCampaigns.find(c => {
                const start = c.startDate?.toDate ? c.startDate.toDate() : new Date(c.startDate);
                // add one day to end date to make it inclusive
                const end = new Date(c.endDate?.toDate ? c.endDate.toDate() : new Date(c.endDate));
                end.setDate(end.getDate() + 1);
                return scheduledFor >= start && scheduledFor <= end;
            });

            // Determine audience for this slot to maintain the desired mix
            let audience: "client" | "contractor";
            let campaignContext: string | undefined;
            let facebookPlaceId: string | undefined;
            let campaignId: string | undefined;
            let locationName: string | undefined;

            if (campaign) {
                audience = campaign.audience === "client" ? "client" : "contractor";
                campaignId = campaign.id;
                facebookPlaceId = campaign.facebookPlaceId;
                locationName = campaign.location;

                campaignContext = `We are running a specific recruitment/lead drive for this post. Make sure the content is highly targeted to this campaign.
Target Location/Region: ${campaign.location || "N/A"}.
${campaign.hookOverride ? `Specific messaging angle/hook to use: "${campaign.hookOverride}"` : ""}
`;
            } else {
                audience = currentClientRatio < clientRatio
                    ? (slotIndex % 2 === 0 ? "client" : "contractor")
                    : (slotIndex % 2 === 0 ? "contractor" : "client");
            }
            slotIndex++;

            if (isReels) {
                // ── REELS FLOW: Gemini caption + Veo 3 video ──
                console.log(`[SocialGenerator] Generating ${audience} reel for ${scheduledFor.toISOString()}...`);

                // 1. Generate reel caption via Gemini
                const captionPrompt = buildReelCaptionPrompt(config, audience, locationName, campaignContext);
                const captionResult = await model.generateContent(captionPrompt);
                const caption = captionResult.response.text().trim();

                if (!caption) {
                    console.error("[SocialGenerator] Gemini returned empty reel caption. Skipping.");
                    continue;
                }

                // 2. Generate video via Veo 3 (with audio)
                let videoUrl: string | null = null;
                let videoStoragePath: string | null = null;
                let videoDurationSeconds = 8;
                try {
                    const videoResult = await generateReelVideo(caption, audience);
                    if (videoResult) {
                        videoUrl = videoResult.videoUrl;
                        videoStoragePath = videoResult.storagePath;
                        videoDurationSeconds = videoResult.durationSeconds;
                    }
                } catch (vidErr: any) {
                    console.warn("[SocialGenerator] Video generation failed, saving caption-only draft:", vidErr.message);
                }

                await db.collection("social_posts").add({
                    platform: "facebook",
                    channel,
                    audience,
                    message: caption,
                    videoUrl,
                    videoStoragePath,
                    videoDurationSeconds,
                    status: "draft",
                    generatedBy: "ai",
                    scheduledFor,
                    campaignId: campaignId || null,
                    facebookPlaceId: facebookPlaceId || null,
                    reviewedBy: null,
                    reviewedAt: null,
                    rejectionReason: null,
                    createdAt: new Date(),
                });

                themes.push(caption.split("\n")[0].slice(0, 60));
                console.log(`[SocialGenerator] ${audience} reel draft created ${videoUrl ? "(with video)" : "(caption only)"}`);

            } else {
                // ── POSTS FLOW: Gemini post + Imagen image ──
                console.log(`[SocialGenerator] Generating ${audience} draft for ${scheduledFor.toISOString()}...`);
                const prompt = buildPrompt(config, summary, themes, audience, campaignContext);
                const result = await model.generateContent(prompt);
                const generatedMessage = result.response.text().trim();

                if (!generatedMessage) {
                    console.error("[SocialGenerator] Gemini returned empty response. Skipping slot.");
                    continue;
                }

                // Generate a branded image for the post
                let imageUrl: string | null = null;
                try {
                    const imageResult = await generatePostImage(generatedMessage, audience);
                    imageUrl = imageResult?.imageUrl || null;
                } catch (imgErr: any) {
                    console.warn("[SocialGenerator] Image generation failed, proceeding without image:", imgErr.message);
                }

                await db.collection("social_posts").add({
                    platform: channel.startsWith("facebook") ? "facebook" : "linkedin",
                    channel,
                    audience,
                    message: generatedMessage,
                    imageUrl,
                    status: "draft",
                    generatedBy: "ai",
                    scheduledFor,
                    campaignId: campaignId || null,
                    facebookPlaceId: facebookPlaceId || null,
                    engagementContext: {
                        avgLikes,
                        avgComments,
                        avgShares,
                        topPostThemes: themes.slice(0, 5),
                    },
                    reviewedBy: null,
                    reviewedAt: null,
                    rejectionReason: null,
                    createdAt: new Date(),
                });

                themes.push(generatedMessage.split("\n")[0].slice(0, 60));
                console.log(`[SocialGenerator] ${audience} draft created for ${scheduledFor.toISOString()} ${imageUrl ? "(with image)" : "(no image)"}`);
            }
        } catch (err: any) {
            console.error(`[SocialGenerator] Error generating for ${scheduledFor.toISOString()}:`, err.message);
        }
    }

    console.log(`[SocialGenerator] Done. Generated ${toGenerate.length} draft(s).`);
}

// Scheduled export: Runs daily at 6 AM ET (11 AM UTC)
export const runSocialContentGenerator = onSchedule({
    schedule: "every day 11:00",
    secrets: ["GEMINI_API_KEY", "FACEBOOK_PAGE_ACCESS_TOKEN"],
}, async () => {
    await generateSocialContent();
});
