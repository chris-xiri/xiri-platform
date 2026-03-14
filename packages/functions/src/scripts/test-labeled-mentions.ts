/**
 * Test labeled mention format: "FSM: @name\nNight Manager: @name"
 * Run: npx ts-node packages/functions/src/scripts/test-labeled-mentions.ts
 */

const url = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";
const chris = "<users/110746313823140729391>";
const tk = `labeled_mention_${Date.now()}`;

async function send(payload: any) {
    const r = await fetch(`${url}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, thread: { threadKey: tk } }),
    });
    const d = await r.json();
    console.log(r.ok ? "✅ Sent" : `❌ ${JSON.stringify(d)}`);
}

async function main() {
    console.log("\n🧪 Labeled Mention Test\n");

    // Shift Started card + labeled mentions
    await send({
        text: `FSM: ${chris}\nNight Manager: ${chris}`,
        cardsV2: [{ cardId: "x1", card: {
            header: { title: "🏁  Shift Started", subtitle: "Audi Queens" },
            sections: [{ widgets: [
                { decoratedText: { topLabel: "CREW", text: "Carlos M.", startIcon: { knownIcon: "PERSON" } } },
                { decoratedText: { topLabel: "CLOCKED IN", text: "7:02 PM", startIcon: { knownIcon: "CLOCK" } } },
                { decoratedText: { topLabel: "NIGHT MANAGER", text: "Chris Leung", startIcon: { knownIcon: "MEMBERSHIP" } } },
            ]}, { widgets: [{ textParagraph: { text: "<i>This thread tracks tonight's shift.</i>" } }] }],
        }}],
    });

    console.log("\n✅ Check #XIRI-Ops-Center — should show:\n   FSM: @Chris Leung\n   Night Manager: @Chris Leung\n   + the card below it");
}

main().catch(console.error);
