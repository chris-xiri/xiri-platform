/**
 * Test different Google Chat message formats.
 * Sends 3 formats to #XIRI-Ops-Center so you can compare visually.
 *
 * Run: npx ts-node packages/functions/src/scripts/test-chat-formats.ts
 */

const WEBHOOK_URL = "https://chat.googleapis.com/v1/spaces/AAQAH8vUSuY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=UMloxPc3sVN4iEoEhD1DW6ai8-kXjCunSKJ5J6V69NA";

async function sendText(threadKey: string, text: string) {
    const url = `${WEBHOOK_URL}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, thread: { threadKey } }),
    });
    console.log("✅ Sent text message");
}

async function sendCard(threadKey: string, card: any, fallbackText?: string) {
    const url = `${WEBHOOK_URL}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: fallbackText || "",
            cardsV2: [{ cardId: "shift-card", card }],
            thread: { threadKey },
        }),
    });
    console.log("✅ Sent card message");
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    // ─── FORMAT A: Structured Plain Text with Emojis ───
    const threadA = `format_test_A_${Date.now()}`;
    console.log("\n--- Format A: Structured Plain Text ---");

    await sendText(threadA,
        `🏁 *SHIFT STARTED*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 Audi Queens\n` +
        `👷 Crew: Carlos M.\n` +
        `🕐 Clocked in: 7:02 PM\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Team: @Mike (NM)\n\n` +
        `_This thread tracks tonight's shift._`
    );

    await sleep(2000);

    await sendText(threadA,
        `✅ Patient Room 101 — scanned _(1/4)_`
    );
    await sleep(1000);
    await sendText(threadA,
        `✅ Main Hallway — scanned _(2/4)_`
    );
    await sleep(1000);
    await sendText(threadA,
        `✅ Lobby — scanned _(3/4)_`
    );
    await sleep(1000);
    await sendText(threadA,
        `✅ Restroom — scanned _(4/4)_`
    );
    await sleep(1000);
    await sendText(threadA,
        `🧹 *ALL ZONES COMPLETE* — Audi Queens`
    );
    await sleep(1000);
    await sendText(threadA,
        `🕐 Crew clocked out — Carlos M. at 8:45 PM`
    );
    await sleep(2000);
    await sendText(threadA,
        `🔍 Night Manager *Mike S.* on-site`
    );
    await sleep(2000);
    await sendText(threadA,
        `✅ *SHIFT VERIFIED*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 Audi Queens\n` +
        `⭐ Score: 5.0 / 5\n` +
        `🔍 Reviewed by Mike S.\n` +
        `🕐 Verified at 9:15 PM\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
    );

    await sleep(3000);

    // ─── FORMAT B: Cards for Key Events, Inline for Zones ───
    const threadB = `format_test_B_${Date.now()}`;
    console.log("\n--- Format B: Cards + Inline Zone Updates ---");

    // Shift Start card
    await sendCard(threadB, {
        header: {
            title: "🏁  Shift Started",
            subtitle: "Audi Queens",
        },
        sections: [{
            widgets: [
                {
                    decoratedText: {
                        topLabel: "CREW",
                        text: "Carlos M.",
                        startIcon: { knownIcon: "PERSON" },
                    },
                },
                {
                    decoratedText: {
                        topLabel: "CLOCKED IN",
                        text: "7:02 PM",
                        startIcon: { knownIcon: "CLOCK" },
                    },
                },
                {
                    decoratedText: {
                        topLabel: "NIGHT MANAGER",
                        text: "Mike S.",
                        startIcon: { knownIcon: "MEMBERSHIP" },
                    },
                },
            ],
        }, {
            widgets: [{
                textParagraph: {
                    text: "<i>This thread tracks all compliance alerts for tonight's shift.</i>",
                },
            }],
        }],
    });

    await sleep(2000);

    // Zone scans as compact text
    await sendText(threadB, `✅ Patient Room 101 _(1/4)_`);
    await sleep(800);
    await sendText(threadB, `✅ Main Hallway _(2/4)_`);
    await sleep(800);
    await sendText(threadB, `✅ Lobby _(3/4)_`);
    await sleep(800);
    await sendText(threadB, `✅ Restroom _(4/4)_  •  🧹 All zones complete!`);

    await sleep(1500);
    await sendText(threadB, `🕐 Crew clocked out — Carlos M. at 8:45 PM`);

    await sleep(2000);
    await sendText(threadB, `🔍 Night Manager *Mike S.* on-site`);

    await sleep(2000);

    // Shift Verified card
    await sendCard(threadB, {
        header: {
            title: "✅  Shift Verified",
            subtitle: "Audi Queens  •  Score: 5.0 ⭐",
        },
        sections: [{
            widgets: [
                {
                    decoratedText: {
                        topLabel: "REVIEWED BY",
                        text: "Mike S. (Night Manager)",
                        startIcon: { knownIcon: "PERSON" },
                    },
                },
                {
                    decoratedText: {
                        topLabel: "VERIFIED AT",
                        text: "9:15 PM",
                        startIcon: { knownIcon: "CLOCK" },
                    },
                },
                {
                    decoratedText: {
                        topLabel: "ZONES",
                        text: "4/4 Complete",
                        startIcon: { knownIcon: "DESCRIPTION" },
                    },
                },
            ],
        }, {
            widgets: [{
                buttonList: {
                    buttons: [{
                        text: "View in Command Center",
                        onClick: {
                            openLink: { url: "https://app.xiri.ai/operations/command-center" },
                        },
                    }],
                },
            }],
        }],
    });

    await sleep(3000);

    // ─── FORMAT C: Cards for Everything (Compact Cards) ───
    const threadC = `format_test_C_${Date.now()}`;
    console.log("\n--- Format C: Compact Cards for Everything ---");

    await sendCard(threadC, {
        header: {
            title: "🏁  Shift Started",
            subtitle: "Audi Queens  •  7:02 PM",
        },
        sections: [{
            widgets: [
                {
                    columns: {
                        columnItems: [
                            {
                                horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                                horizontalAlignment: "START",
                                verticalAlignment: "CENTER",
                                widgets: [{
                                    decoratedText: {
                                        topLabel: "CREW",
                                        text: "Carlos M.",
                                    },
                                }],
                            },
                            {
                                horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                                horizontalAlignment: "START",
                                verticalAlignment: "CENTER",
                                widgets: [{
                                    decoratedText: {
                                        topLabel: "NIGHT MANAGER",
                                        text: "Mike S.",
                                    },
                                }],
                            },
                        ],
                    },
                },
            ],
        }],
    });

    await sleep(2000);

    // Progress card with all zones
    await sendCard(threadC, {
        sections: [{
            header: "Zone Progress",
            widgets: [
                { decoratedText: { text: "✅ Patient Room 101", bottomLabel: "7:12 PM" } },
                { decoratedText: { text: "✅ Main Hallway", bottomLabel: "7:28 PM" } },
                { decoratedText: { text: "✅ Lobby", bottomLabel: "7:45 PM" } },
                { decoratedText: { text: "✅ Restroom", bottomLabel: "8:01 PM" } },
            ],
        }, {
            widgets: [{
                textParagraph: {
                    text: "🧹 <b>All 4 zones complete</b>  •  Crew clocked out at 8:45 PM",
                },
            }],
        }],
    });

    await sleep(2000);

    await sendCard(threadC, {
        header: {
            title: "✅  Shift Verified",
            subtitle: "Score: ⭐⭐⭐⭐⭐ (5.0)",
        },
        sections: [{
            widgets: [
                {
                    columns: {
                        columnItems: [
                            {
                                horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                                horizontalAlignment: "START",
                                verticalAlignment: "CENTER",
                                widgets: [{
                                    decoratedText: {
                                        topLabel: "REVIEWER",
                                        text: "Mike S.",
                                    },
                                }],
                            },
                            {
                                horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                                horizontalAlignment: "START",
                                verticalAlignment: "CENTER",
                                widgets: [{
                                    decoratedText: {
                                        topLabel: "TIME",
                                        text: "9:15 PM",
                                    },
                                }],
                            },
                        ],
                    },
                },
            ],
        }, {
            widgets: [{
                buttonList: {
                    buttons: [{
                        text: "Open Command Center",
                        onClick: {
                            openLink: { url: "https://app.xiri.ai/operations/command-center" },
                        },
                    }],
                },
            }],
        }],
    });

    console.log("\n🎉 Done! Check #XIRI-Ops-Center — 3 threads with different formats:");
    console.log("  A: Structured plain text with emoji dividers");
    console.log("  B: Cards for key moments (start/end), inline text for zone scans");
    console.log("  C: Cards for everything (most visual, but bulkier)");
}

main().catch(console.error);
