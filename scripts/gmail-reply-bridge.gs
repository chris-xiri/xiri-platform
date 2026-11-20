/**
 * XIRI Gmail Inbound Reply Bridge (Google Apps Script)
 *
 * Connects replies landing in chris@xiri.ai (Google Workspace) directly to
 * XIRI's `inboundReplyWebhook` Cloud Function without changing xiri.ai MX records.
 *
 * SETUP (2 minutes, one-time):
 *   1. Open https://script.google.com while signed into chris@xiri.ai
 *   2. Click "New Project" → name it "XIRI SDR Reply Bridge"
 *   3. Paste this entire file and save (Ctrl+S)
 *   4. Run `installTrigger()` once and approve Gmail + external URL permissions
 *
 * HOW IT WORKS:
 *   - Runs every 5 minutes automatically.
 *   - Scans recent inbox threads not yet labeled `SDR-Triaged`.
 *   - For each external reply message, POSTs { from, subject, text } to XIRI's
 *     `inboundReplyWebhook` endpoint.
 *   - Non-CRM senders are ignored cleanly by the backend; matched prospects trigger
 *     Gemini intent triage, immediately cancel active cold drips, promote hot leads
 *     to `qualified`, and send a Google Chat alert linking to app.xiri.ai.
 */

const WEBHOOK_URL = 'https://us-central1-xiri-facility-solutions.cloudfunctions.net/inboundReplyWebhook';
const PROCESSED_LABEL_NAME = 'SDR-Triaged';

function processInboundReplies() {
  let label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(PROCESSED_LABEL_NAME);
  }

  const myEmail = Session.getActiveUser().getEmail().toLowerCase();
  const threads = GmailApp.search(`in:inbox -label:${PROCESSED_LABEL_NAME} newer_than:2d`, 0, 40);

  for (const thread of threads) {
    const messages = thread.getMessages();
    const latest = messages[messages.length - 1];
    const fromRaw = latest.getFrom() || '';

    // Skip messages sent by Chris himself
    if (fromRaw.toLowerCase().includes(myEmail) || fromRaw.toLowerCase().includes('@xiri.ai')) {
      continue;
    }

    const payload = {
      from: fromRaw,
      subject: latest.getSubject() || '',
      text: (latest.getPlainBody() || '').slice(0, 4000),
      receivedAt: latest.getDate().toISOString(),
      source: 'gmail_apps_script',
    };

    try {
      const response = UrlFetchApp.fetch(WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        thread.addLabel(label);
        Logger.log(`Triaged reply from ${fromRaw}: ${response.getContentText()}`);
      } else {
        Logger.log(`Webhook HTTP ${code} for ${fromRaw}: ${response.getContentText()}`);
      }
    } catch (err) {
      Logger.log(`Error forwarding reply from ${fromRaw}: ${err}`);
    }
  }
}

/**
 * Run this function ONCE from the Apps Script toolbar to install the 5-minute trigger.
 */
function installTrigger() {
  // Remove any existing triggers for this function to avoid duplicates
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'processInboundReplies') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('processInboundReplies')
    .timeBased()
    .everyMinutes(5)
    .create();

  // Run immediately once to verify permissions and create the label
  processInboundReplies();
  Logger.log('✅ XIRI SDR Reply Bridge installed (runs every 5 minutes).');
}
