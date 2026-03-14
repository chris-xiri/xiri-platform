/**
 * Test script: Run Clarity report pipeline directly
 * Usage: npx tsx packages/functions/src/scripts/test-clarity-report.ts
 */

import { fetchClarityInsights, postClarityReportToChat, getClarityLinks } from "../utils/clarityUtils";

const CLARITY_TOKEN = process.env.CLARITY_API_TOKEN || "";
const CHAT_WEBHOOK = process.env.CLARITY_CHAT_WEBHOOK_URL || "";

async function main() {
    if (!CLARITY_TOKEN) throw new Error("Set CLARITY_API_TOKEN env var");
    if (!CHAT_WEBHOOK) throw new Error("Set CLARITY_CHAT_WEBHOOK_URL env var");

    console.log("📊 Fetching Clarity data (last 3 days)...");
    const metrics = await fetchClarityInsights(CLARITY_TOKEN, 3);
    console.log(`   Sessions: ${metrics.totalSessions}`);
    console.log(`   Dead clicks: ${metrics.deadClickCount} (${metrics.deadClickSessionPct}% of sessions)`);
    console.log(`   Rage clicks: ${metrics.rageClickCount} (${metrics.rageClickSessionPct}% of sessions)`);
    console.log(`   Scroll depth: ${metrics.scrollDepth}%`);
    console.log(`   Quick-backs: ${metrics.quickbackCount}`);
    console.log(`   Top pages: ${metrics.topPages.length}`);
    metrics.topPages.slice(0, 5).forEach(p => console.log(`     ${p.sessions} visits — ${p.url}`));

    const links = getClarityLinks(3);
    console.log("\n🔗 Filtered links:");
    console.log(`   Dead clicks: ${links.deadClicks}`);
    console.log(`   Rage clicks: ${links.rageClicks}`);
    console.log(`   Quick-backs: ${links.quickbacks}`);

    console.log("\n💬 Posting to Google Chat...");
    await postClarityReportToChat(metrics, CHAT_WEBHOOK);
    console.log("✅ Done! Check your Google Chat.");
}

main().catch((err) => {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
});
