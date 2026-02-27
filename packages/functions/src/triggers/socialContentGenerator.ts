/**
 * AI Social Content Generator
 * Runs on a schedule, fetches Facebook engagement data, 
 * and uses Gemini to generate draft posts for review.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../utils/firebase";
import { getRecentPosts } from "../utils/facebookApi";

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
    recentPostSummaries: string[]
): string {
    return `You are the social media manager for XIRI Facility Solutions, a facility management company based in New York that services commercial and medical buildings across Queens, Nassau, and Suffolk County.

## BUSINESS CONTEXT
- XIRI hires independent sub-contractors (cleaning, HVAC, maintenance, specialty trades) to fulfill contracts XIRI holds with medical offices, urgent care clinics, auto dealerships, and commercial facilities.
- For CONTRACTORS: We offer steady contract work, one point of contact, fast payouts (10th of the month), no franchise fees.
- For CLIENTS: We are their single point of contact for all facility maintenance — one call, one invoice, audit-ready standards.
- Website: xiri.ai
- Service Areas: Queens, Nassau County, Suffolk County, Long Island

## ENGAGEMENT DATA (Last 20 Posts)
${engagementSummary}

## RECENT POST THEMES (avoid repeating these)
${recentPostSummaries.length > 0 ? recentPostSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n") : "No recent posts yet."}

## CONTENT PREFERENCES
- Tone: ${config.tone || "Professional, bold, blue-collar-friendly but executive-grade"}
- Topics to focus on: ${config.topics.length > 0 ? config.topics.join(", ") : "contractor recruitment, client success, industry tips, behind-the-scenes, company culture"}
- Hashtags to include: ${config.hashtagSets.length > 0 ? config.hashtagSets.join(" ") : "#FacilityManagement #CommercialCleaning #LongIsland #Queens #NYContractors"}

## YOUR TASK
Generate exactly 1 Facebook post for XIRI Facility Solutions. The post should:

1. Be formatted for Facebook (use emoji as paragraph-style bullets, not checkmarks)
2. Be 100-250 words
3. Include a clear call-to-action
4. Include relevant hashtags at the end
5. Be different from the recent posts listed above
6. Drive engagement (likes, comments, shares) based on what performed well in the engagement data
7. Alternate between targeting CONTRACTORS (recruitment) and CLIENTS (lead gen) — choose whichever was NOT the focus of the most recent posts
8. Be written in a natural, human voice — not corporate jargon
9. If targeting contractors, emphasize: steady work, fast pay, no admin hassle
10. If targeting clients, emphasize: one-call solution, audit-ready, quality assurance, consolidated billing

Respond with ONLY the post text. No introductions, no explanations, just the ready-to-publish Facebook post.`;
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
export async function generateSocialContent(): Promise<void> {
    console.log("[SocialGenerator] Starting content generation...");

    // 1. Read config
    const configDoc = await db.collection("social_config").doc("facebook").get();
    if (!configDoc.exists) {
        console.log("[SocialGenerator] No social config found. Skipping.");
        return;
    }

    const config = configDoc.data() as SocialConfig;
    if (!config.enabled) {
        console.log("[SocialGenerator] Social posting is disabled. Skipping.");
        return;
    }

    // 2. Get the next 3 posting dates
    const TARGET_QUEUE_SIZE = 3;
    const upcomingDates = getNextPostingDates(config, TARGET_QUEUE_SIZE);
    console.log(`[SocialGenerator] Next ${TARGET_QUEUE_SIZE} posting dates:`, upcomingDates.map(d => d.toISOString()));

    // 3. Check which dates already have drafts
    const now = new Date();
    const pendingDrafts = await db.collection("social_posts")
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

    // 5. Generate content for each missing slot
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    for (const scheduledFor of toGenerate) {
        try {
            console.log(`[SocialGenerator] Generating draft for ${scheduledFor.toISOString()}...`);
            const prompt = buildPrompt(config, summary, themes);
            const result = await model.generateContent(prompt);
            const generatedMessage = result.response.text().trim();

            if (!generatedMessage) {
                console.error("[SocialGenerator] Gemini returned empty response. Skipping slot.");
                continue;
            }

            await db.collection("social_posts").add({
                platform: "facebook",
                message: generatedMessage,
                status: "draft",
                generatedBy: "ai",
                scheduledFor,
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

            // Add the generated message to themes so the next draft in this batch avoids repeating it
            themes.push(generatedMessage.split("\n")[0].slice(0, 60));

            console.log(`[SocialGenerator] Draft created for ${scheduledFor.toISOString()}`);
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
