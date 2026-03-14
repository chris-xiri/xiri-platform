/**
 * Full test: Format B + NM/FM mentions on all key events.
 * Run: npx ts-node packages/functions/src/scripts/test-full-mentions.ts
 */

const WH = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";
const CHRIS = "110746313823140729391"; // NM + FM for this test
const TK = `full_mention_test_${Date.now()}`;

async function text(t: string) {
    await fetch(`${WH}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, thread: { threadKey: TK } }),
    });
    console.log(`✅ ${t.substring(0, 50)}`);
}

async function card(c: any, fallback: string) {
    await fetch(`${WH}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fallback, cardsV2: [{ cardId: `x-${Date.now()}`, card: c }], thread: { threadKey: TK } }),
    });
    console.log(`✅ CARD: ${fallback.substring(0, 60)}`);
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const tag = `<users/${CHRIS}>`;

async function main() {
    console.log("\n🧪 Full Test: NM + FM Mentions on All Key Events\n");

    // 1. Shift Started — tags NM + FM
    await card({
        header: { title: "🏁  Shift Started", subtitle: "Audi Queens" },
        sections: [
            { widgets: [
                { decoratedText: { topLabel: "CREW", text: "Carlos M.", startIcon: { knownIcon: "PERSON" } } },
                { decoratedText: { topLabel: "CLOCKED IN", text: "7:02 PM", startIcon: { knownIcon: "CLOCK" } } },
                { decoratedText: { topLabel: "NIGHT MANAGER", text: "Chris Leung", startIcon: { knownIcon: "MEMBERSHIP" } } },
            ]},
            { widgets: [{ textParagraph: { text: "<i>This thread tracks all compliance alerts for tonight's shift.</i>" } }] },
        ],
    }, `🏁 Shift Started: Audi Queens ${tag} ${tag}`);

    await wait(2000);

    // 2-5. Zone scans
    await text("✅ Patient Room 101 _(1/4)_");
    await wait(600);
    await text("✅ Main Hallway _(2/4)_");
    await wait(600);
    await text("✅ Lobby _(3/4)_");
    await wait(600);
    await text("✅ Restroom _(4/4)_");
    await wait(600);
    await text("🧹 *All zones complete* — Audi Queens");
    await wait(800);
    await text("🕐 Crew clocked out — Carlos M. at 8:45 PM");
    await wait(1500);
    await text("🔍 Night Manager *Chris Leung* on-site");
    await wait(2000);

    // 9. Shift Verified — tags FM
    await card({
        header: { title: "✅  Shift Verified", subtitle: "Audi Queens  •  Score: 5/5 ⭐" },
        sections: [
            { widgets: [
                { decoratedText: { topLabel: "REVIEWED BY", text: "Chris Leung (Night Manager)", startIcon: { knownIcon: "PERSON" } } },
                { decoratedText: { topLabel: "VERIFIED AT", text: "9:15 PM", startIcon: { knownIcon: "CLOCK" } } },
            ]},
            { widgets: [{ buttonList: { buttons: [{ text: "View in Command Center", onClick: { openLink: { url: "https://app.xiri.ai/operations/command-center" } } }] } }] },
        ],
    }, `✅ Shift Verified: Audi Queens ${tag}`);

    console.log("\n🎉 Done! You should get notifications for Shift Started (NM+FM) and Shift Verified (FM)");
}

main().catch(console.error);
