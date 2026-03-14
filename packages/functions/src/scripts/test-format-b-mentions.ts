/**
 * End-to-end test: Format B cards with @mentions.
 * Simulates a full shift with proper mention tagging.
 * Run: npx ts-node packages/functions/src/scripts/test-format-b-mentions.ts
 */

const WEBHOOK_URL = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";
const CHRIS_GOOGLE_ID = "110746313823140729391";
const THREAD_KEY = `final_test_${Date.now()}`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function sendText(text: string) {
    await fetch(`${WEBHOOK_URL}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, thread: { threadKey: THREAD_KEY } }),
    });
    console.log(`✅ Text: ${text.substring(0, 60)}...`);
}

async function sendCard(card: any, fallbackText: string) {
    await fetch(`${WEBHOOK_URL}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: fallbackText,
            cardsV2: [{ cardId: `xiri-${Date.now()}`, card }],
            thread: { threadKey: THREAD_KEY },
        }),
    });
    console.log(`✅ Card: ${fallbackText.substring(0, 60)}...`);
}

async function main() {
    const mention = `<users/${CHRIS_GOOGLE_ID}>`;
    console.log("\n🧪 Final Test: Format B + @Mentions\n");

    // 1. Shift Started — CARD with NM mention
    await sendCard({
        header: { title: "🏁  Shift Started", subtitle: "Audi Queens" },
        sections: [
            { widgets: [
                { decoratedText: { topLabel: "CREW", text: "Carlos M.", startIcon: { knownIcon: "PERSON" } } },
                { decoratedText: { topLabel: "CLOCKED IN", text: "7:02 PM", startIcon: { knownIcon: "CLOCK" } } },
                { decoratedText: { topLabel: "NIGHT MANAGER", text: "Chris Leung", startIcon: { knownIcon: "MEMBERSHIP" } } },
            ]},
            { widgets: [{ textParagraph: { text: "<i>This thread tracks all compliance alerts for tonight's shift.</i>" } }] },
        ],
    }, `🏁 Shift Started: Audi Queens ${mention}`);

    await sleep(2000);

    // 2-5. Zone scans — inline text
    await sendText("✅ Patient Room 101 _(1/4)_");
    await sleep(800);
    await sendText("✅ Main Hallway _(2/4)_");
    await sleep(800);
    await sendText("✅ Lobby _(3/4)_");
    await sleep(800);
    await sendText("✅ Restroom _(4/4)_");
    await sleep(800);

    // 6. All zones done
    await sendText("🧹 *All zones complete* — Audi Queens");
    await sleep(1000);

    // 7. Clock out
    await sendText("🕐 Crew clocked out — Carlos M. at 8:45 PM");
    await sleep(2000);

    // 8. NM on-site
    await sendText("🔍 Night Manager *Chris Leung* on-site");
    await sleep(2000);

    // 9. Shift Verified — CARD with FM mention
    await sendCard({
        header: { title: "✅  Shift Verified", subtitle: "Audi Queens  •  Score: 5/5 ⭐" },
        sections: [
            { widgets: [
                { decoratedText: { topLabel: "REVIEWED BY", text: "Chris Leung (Night Manager)", startIcon: { knownIcon: "PERSON" } } },
                { decoratedText: { topLabel: "VERIFIED AT", text: "9:15 PM", startIcon: { knownIcon: "CLOCK" } } },
            ]},
            { widgets: [{ buttonList: { buttons: [{ text: "View in Command Center", onClick: { openLink: { url: "https://app.xiri.ai/operations/command-center" } } }] } }] },
        ],
    }, `✅ Shift Verified: Audi Queens ${mention}`);

    console.log("\n🎉 Done! Check #XIRI-Ops-Center — you should get 2 notifications (Shift Started + Shift Verified)");
}

main().catch(console.error);
