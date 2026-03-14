/**
 * Test Google Chat Thread Integration
 *
 * Sends a series of messages to #XIRI-Ops-Center to verify:
 * 1. Thread creation with threadKey
 * 2. Replies going to the same thread
 * 3. Message formatting
 *
 * Run: npx ts-node packages/functions/src/scripts/test-google-chat.ts
 */

const WEBHOOK_URL = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";

const TIMEZONE = "America/New_York";

function fmtTime(): string {
    return new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: TIMEZONE,
    });
}

async function sendMessage(threadKey: string, text: string) {
    const url = `${WEBHOOK_URL}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;

    const body = {
        text,
        thread: { threadKey },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Failed (${response.status}):`, errText);
        return;
    }

    const data = await response.json();
    console.log(`✅ Sent: "${text.substring(0, 60)}..."`);
    console.log(`   Thread: ${data.thread?.name || "unknown"}`);
}

async function main() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const threadKey = `test_shift_loc1_${dateStr}`;

    console.log(`\n🧪 Testing Google Chat Thread Integration`);
    console.log(`   Thread Key: ${threadKey}`);
    console.log(`   Time: ${fmtTime()}\n`);

    // 1. Shift started (creates thread)
    console.log("--- Step 1: Shift Started ---");
    await sendMessage(threadKey,
        `🏁 *Shift Started: Test Chris Leung Urgent Care*\n` +
        `Crew: Maria Rodriguez | Clocked in at ${fmtTime()}\n` +
        `Team: <users/chris@xiri.ai> (NM)\n\n` +
        `_This thread will track all compliance alerts for tonight's shift._`
    );

    await new Promise(r => setTimeout(r, 2000));

    // 2. Zone scanned (replies to thread)
    console.log("\n--- Step 2: Zone Scanned ---");
    await sendMessage(threadKey,
        `✅ *Patient Room 101* scanned (1/4)`
    );

    await new Promise(r => setTimeout(r, 1500));

    // 3. Another zone
    console.log("\n--- Step 3: Zone Scanned ---");
    await sendMessage(threadKey,
        `✅ *Main Hallway* scanned (2/4)`
    );

    await new Promise(r => setTimeout(r, 1500));

    // 4. All zones done
    console.log("\n--- Step 4: All Zones Done ---");
    await sendMessage(threadKey,
        `🧹 *All zones complete* — Test Chris Leung Urgent Care`
    );

    await new Promise(r => setTimeout(r, 1500));

    // 5. Crew clocked out
    console.log("\n--- Step 5: Clock Out ---");
    await sendMessage(threadKey,
        `🕐 *Crew clocked out* — Maria Rodriguez at ${fmtTime()}`
    );

    await new Promise(r => setTimeout(r, 1500));

    // 6. Night Manager on-site
    console.log("\n--- Step 6: NM Clock In ---");
    await sendMessage(threadKey,
        `🔍 *Night Manager James Park* on-site — Test Chris Leung Urgent Care`
    );

    await new Promise(r => setTimeout(r, 1500));

    // 7. Shift verified
    console.log("\n--- Step 7: Shift Verified ---");
    await sendMessage(threadKey,
        `✅ *Shift Verified: Test Chris Leung Urgent Care* — Score: 5.0/5\n` +
        `Reviewed by James Park at ${fmtTime()}\n` +
        `<users/chris@xiri.ai> — please review.`
    );

    console.log("\n🎉 Done! Check #XIRI-Ops-Center for the thread.");
}

main().catch(console.error);
