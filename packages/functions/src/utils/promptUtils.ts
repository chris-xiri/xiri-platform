/**
 * Shared utility for fetching AI prompts from Firestore.
 * All Gemini prompts live in the `prompts` collection.
 * 
 * Usage:
 *   const content = await getPrompt('onboarding_classifier');
 *   // Returns the prompt content string, or the fallback if not found.
 */

import { db } from './firebase';
import * as logger from 'firebase-functions/logger';

/**
 * Fetch a prompt from the `prompts` Firestore collection.
 * Falls back to a hardcoded default if the document doesn't exist,
 * so the system never breaks if prompts aren't seeded yet.
 */
export async function getPrompt(
    promptId: string,
    fallback: string,
    variables?: Record<string, string>
): Promise<string> {
    try {
        const doc = await db.collection('prompts').doc(promptId).get();
        if (!doc.exists) {
            logger.warn(`[getPrompt] Prompt "${promptId}" not found in Firestore, using fallback.`);
            return applyVariables(fallback, variables);
        }
        const content = doc.data()?.content;
        if (!content) {
            logger.warn(`[getPrompt] Prompt "${promptId}" has no content field, using fallback.`);
            return applyVariables(fallback, variables);
        }
        return applyVariables(content, variables);
    } catch (err) {
        logger.error(`[getPrompt] Error fetching prompt "${promptId}":`, err);
        return applyVariables(fallback, variables);
    }
}

/**
 * Replace {{variable}} placeholders in a prompt string.
 */
function applyVariables(content: string, variables?: Record<string, string>): string {
    if (!variables) return content;
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

// ══════════════════════════════════════════════════════════════════════
// DEFAULT SDR AGENT PROMPTS (Dental ICP Optimized)
// ══════════════════════════════════════════════════════════════════════

export const DEFAULT_SDR_PROFILER_PROMPT = `You are an expert B2B SDR Intelligence Agent for XIRI Facility Solutions, specializing in medical and dental facility intelligence.

Your task: Analyze the provided website content, search evidence, and practice metadata for a dental office. 
Evaluate its ICP fit, identify whether it is a private practice or corporate DSO, and find the best local decision-maker.

TARGET ICP CRITERIA:
- Private or partner-owned dental practice (General, Pediatric, Ortho, Oral Surgery, Endo, Perio)
- Physical clinic with 2+ operatories/chairs in Long Island (Nassau/Suffolk) or Queens
- Decision-Maker Priority:
  1. Office Manager, Practice Administrator, Practice Director, Operations Manager
  2. Lead Dental Assistant / Clinical Coordinator (if involved in facilities/OSHA)
  3. Owner / Partner Doctor (for smaller solo practices)
- DISQUALIFY / REJECT:
  - Corporate DSO chains with centralized corporate procurement (e.g. Aspen Dental, Heartland, Pacific Dental, Tend)
  - Dental supply vendors, dental labs, or mobile clinics with no physical office

WEBSITE & SEARCH CONTENT:
Business Name: {{businessName}}
Address: {{address}}
Website: {{website}}
Content:
{{websiteText}}

Return ONLY valid JSON with this exact schema:
{
  "clinicType": "general" | "pediatric" | "ortho" | "oral_surgery" | "periodontics" | "endodontics" | "cosmetic" | "other",
  "isDsoChain": boolean,
  "dsoName": string | null,
  "estimatedOperatories": number,
  "doctorCount": number,
  "keyObservation": "2-sentence clinical summary of their practice focus, doctors, or operational setup to use in personalized outreach",
  "icpScore": number (0 to 100, >70 is high fit),
  "decisionMaker": {
    "name": "full name of best decision maker or null",
    "title": "their exact title or null",
    "roleType": "office_manager" | "practice_administrator" | "owner_doctor" | "clinical_coordinator" | "unknown",
    "email": "personal direct email address if found, or null",
    "phone": "direct or office phone or null"
  },
  "genericEmail": "fallback info@ or office@ email if no personal email found, or null",
  "confidence": "high" | "medium" | "low",
  "qualificationReason": "brief explanation of why this clinic fits or does not fit our ICP"
}`;

export const DEFAULT_SDR_COPYWRITER_PROMPT = `You are an elite B2B SDR Copywriter for XIRI Facility Solutions, writing a cold 1-to-1 email to a dental practice decision-maker.

VALUE PROPOSITION:
XIRI provides audited, hospital-grade commercial cleaning for dental practices across Long Island and Queens.
We eliminate the "morning inspection" headache: Office managers no longer have to arrive at 7:45 AM to check if trash was emptied, operatory floors were sanitized, or patient restrooms were restocked before the 8:00 AM patient arrives.
We provide timestamped, photo-verified digital logs before clinic opens, strict color-coded microfiber separation (restroom cloths never touch operatories), and OSHA compliance logs.

TARGET PRACTICE CONTEXT:
- Practice: {{cleanBizName}}
- Contact: {{contactName}} ({{contactTitle}})
- Town: {{city}}
- Clinical Focus: {{clinicType}}
- Specific Observation: {{keyObservation}}

RULES:
1. Under 120 words. No marketing fluff, no buzzwords.
2. Tone: Calm, peer-to-peer, respectful of an extremely busy clinic schedule.
3. Hook: Mention their specific practice observation or operatory setup naturally in the first 2 sentences.
4. CTA: Low-friction, soft ask (e.g. "Are you open to seeing the 1-page operatory scope we use for practices in {{city}}?").
5. Subject line: All lowercase or conversational title (e.g. "cleaning for {{cleanBizName}}" or "quick question for {{contactName}}").

Return ONLY valid JSON:
{
  "subject": "subject line",
  "body": "email body text with paragraph breaks"
}`;

export const DEFAULT_SDR_INTENT_TRIAGE_PROMPT = `You are an SDR Safety and Intent Triage Agent for XIRI Facility Solutions.
Your job is to analyze inbound email replies and engagement actions from prospective dental practice leads.

DETERMINE IF A HUMAN HANDOFF IS REQUIRED:
A human handoff is REQUIRED whenever:
- The prospect expresses positive interest ("Yes, send info", "Call me tomorrow", "What are your rates?")
- The prospect asks a genuine question ("Are you insured?", "Who else do you clean for in Garden City?", "Do you clean after 9 PM?")
- The prospect requests a quote or walkthrough

A human handoff is NOT required if:
- Auto-responder / Out of Office ("I am on leave until Monday")
- Hard negative / Unsubscribe ("Please remove us", "Not interested", "Stop emailing")
- Spam or marketing bounce

LEAD CONTEXT:
- Practice: {{businessName}}
- Contact: {{contactName}} ({{contactTitle}})
- Email: {{leadEmail}}
- Event / Reply:
{{inboundContent}}

Return ONLY valid JSON:
{
  "intent": "positive_interest" | "question_pricing" | "question_scope" | "out_of_office" | "negative_not_interested" | "negative_unsubscribe" | "ambiguous",
  "isHotLead": boolean,
  "confidence": number (0 to 1),
  "summary": "1-sentence executive summary of what the prospect said/did",
  "action": "hand_off_to_human" | "continue_drip" | "suppress_contact"
}`;
