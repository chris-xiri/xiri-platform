# Autonomous Agentic SDR & Dental Outbound Engine

This document explains how the Autonomous SDR process runs, its automated schedules, the 3-agent pipeline, and how to operate and deploy it.

---

## 1. How It Runs Automatically (Scheduled Workflows)

Once deployed, the system operates completely autonomously in the background via Firebase Cloud Scheduler:

| Automated Workflow | Schedule (EST) | Function Name | What It Does |
| :--- | :--- | :--- | :--- |
| **Morning Prospector & Profiling** | **Daily at 6:00 AM** | `dailyProspector` | • Queries Google Places API across active dental ICP queries (`dental office`, `orthodontist`, `pediatric dentist`, `oral surgeon office`, `endodontist`) in 76 towns.<br>• Runs **Agent 1 (Intelligence Profiler)** to scrape practice websites, detect operatory chair counts, verify private practice vs corporate DSO, and identify Office Managers.<br>• Runs **Agent 2 (1-to-1 Copywriter)** to draft personalized plain-text cold emails.<br>• Saves enriched leads with `ClinicDossier` and `outreachDraft` to `prospect_queue`. |
| **Outreach Delivery Worker** | **Every 5 Minutes** | `processOutreachQueue` | • Sends queued emails via Resend.<br>• **Strict Human Boundary**: Checks if the lead is in an active sales stage (`qualified`, `walkthrough`, `proposal`, `quoted`, `won`). If active, immediately cancels automated cold drip tasks.<br>• **Inbox Placement**: Automatically strips visual SVG logos/banners (`skipHeader: true`) on cold outbound so emails land in the Primary inbox. |
| **Daily Engagement Digest** | **Daily at 5:00 PM** | `dailyEmailEngagementDigest` | • Scans email events over the last 24 hours.<br>• Dispatches an engagement summary card directly to your Google Chat space.<br>• Lists high-intent leads (who clicked or opened multiple times) with a 1-click link to view them in the CRM. |
| **Real-Time Intent Radar & Handoff** | **Instant (On Event)** | `triageLeadEngagement` | • Analyzes replies or engagement with **Agent 3 (Intent Triage)**.<br>• If positive interest or pricing inquiry: freezes cold drip tasks, upgrades lead to `qualified` in CRM, and posts a high-priority Google Chat alert for Chris to take over. |

---

## 2. On-Demand / Manual Triggers

You do not have to wait for the 6:00 AM run or the 5:00 PM digest:

- **Run Prospecting Now**:
  Go to the dashboard at `/sales/prospects` and click the **"Run Now"** button in the top right.
- **Trigger Google Chat Digest Now**:
  Run from terminal:
  ```bash
  npx tsx scripts/test-chat-engagement-digest.ts --hours=24 --send
  ```
- **Edit Agent Prompts in UI**:
  In the dashboard under `/sales/prospects`, click **"ICP Config Dashboard"** to open the **Autonomous SDR Agent Studio**:
  - **Agent 1**: Website & Persona Intelligence Profiler (`sdr_profiler`).
  - **Agent 2**: 1-to-1 Hyper-Personalized Plaintext Copywriter (`sdr_copywriter`).
  - **Agent 3**: Intent Radar & Human Handoff Triage (`sdr_intent_triage`).
  - Use the **"Reset to Dental Defaults"** button to restore battle-tested prompts at any time.

---

## 3. Human Sales Pipeline Boundary

To ensure the agent never steps on your toes:
- Cold outbound automation is restricted to raw leads (`pending_review`).
- As soon as a lead moves to any active human sales stage (`qualified`, `walkthrough`, `proposal`, `quoted`, `won`) or sends a positive reply, **all automated tasks for that lead are immediately cancelled**.

---

## 4. Deploying to Firebase

Before deploying, re-authenticate the Firebase CLI once in your terminal:

```bash
# 1. Re-authenticate in your browser
npx firebase login --reauth

# 2. Deploy the updated functions
npx firebase deploy --only functions:triageLeadEngagement,functions:dailyEmailEngagementDigest,functions:triggerDailyEngagementDigest,functions:processOutreachQueue,functions:startLeadSequence,functions:dailyProspector,functions:triggerDailyProspector
```
