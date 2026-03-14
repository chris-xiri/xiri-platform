/**
 * Test @mention with the numeric Google User ID from SSO.
 * Run: npx ts-node packages/functions/src/scripts/test-mention-uid.ts
 */

const WEBHOOK_URL = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";

async function send(text: string) {
    const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    const data = await resp.json();
    console.log(`${resp.ok ? '✅' : '❌'} Sent: ${text}`);
    if (!resp.ok) console.log(`   Error: ${JSON.stringify(data)}`);
    else console.log(`   Response name: ${data.name}`);
}

async function main() {
    console.log("\n🧪 Testing @mention with numeric Google User ID...\n");

    // Test with the actual numeric ID from Firestore
    await send("🔔 Mention test: <users/110746313823140729391> can you see this?");

    console.log("\n✅ Check #XIRI-Ops-Center — did you get a notification?");
}

main().catch(console.error);
