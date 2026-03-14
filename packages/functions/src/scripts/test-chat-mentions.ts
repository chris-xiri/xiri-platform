/**
 * Test different mention formats in Google Chat.
 * Run: npx ts-node packages/functions/src/scripts/test-chat-mentions.ts
 */

const WEBHOOK_URL = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";

async function send(text: string) {
    const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    const data = await resp.json();
    console.log(`${resp.ok ? '✅' : '❌'} Sent: ${text.substring(0, 80)}`);
    if (!resp.ok) console.log(`   Error: ${JSON.stringify(data)}`);
}

async function main() {
    console.log("\n🧪 Testing mention formats...\n");

    // Format 1: <users/email>
    await send("Test 1 — email format: <users/chris@xiri.ai>");

    await new Promise(r => setTimeout(r, 1500));

    // Format 2: <users/all> (mention everyone)
    await send("Test 2 — @all format: <users/all>");

    await new Promise(r => setTimeout(r, 1500));

    // Format 3: Bold name as fallback
    await send("Test 3 — bold fallback: *@Chris Leung* please review");

    console.log("\n✅ Check which formats show as clickable mentions in Google Chat");
}

main().catch(console.error);
