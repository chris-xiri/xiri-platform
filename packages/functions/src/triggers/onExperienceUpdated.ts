/**
 * onExperienceUpdated — Firestore trigger
 *
 * Fires whenever a vendor document is updated. If `onboarding.experienceRaw`
 * changed (and is non-empty), sends the raw text to Gemini 2.0 Flash and
 * writes back a concise `onboarding.experienceSummary`.
 *
 * Guard rails:
 *  - Only fires when experienceRaw actually changes (avoids infinite loop)
 *  - Skips empty/whitespace-only input
 *  - Does NOT overwrite experienceRaw — only writes experienceSummary
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../utils/firebase';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const SUMMARY_PROMPT = `You are an internal CRM assistant for a facility management company.
Summarize the following vendor experience notes into 2-3 concise bullet points.
Focus on: years of experience, key clients or property types served, team strengths, and any notable projects.
Keep it professional, factual, and under 100 words. Use bullet points (•).

Raw experience notes:
---
{RAW_TEXT}
---

Summary:`;

export const onExperienceUpdated = onDocumentUpdated({
    document: 'vendors/{vendorId}',
    secrets: [GEMINI_API_KEY],
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const vendorId = event.params.vendorId;

    // Extract onboarding objects
    const prevRaw = before.onboarding?.experienceRaw || '';
    const newRaw = after.onboarding?.experienceRaw || '';

    // Guard: only fire when experienceRaw actually changed
    if (prevRaw === newRaw) return;

    // Guard: skip if cleared / empty
    if (!newRaw.trim()) {
        logger.info(`[ExperienceSummary] ${vendorId} — experienceRaw cleared, skipping.`);
        return;
    }

    logger.info(`[ExperienceSummary] ${vendorId} — generating AI summary (${newRaw.length} chars)`);

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = SUMMARY_PROMPT.replace('{RAW_TEXT}', newRaw);
        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();

        if (!summary) {
            logger.warn(`[ExperienceSummary] ${vendorId} — Gemini returned empty summary.`);
            return;
        }

        // Write back ONLY the summary — do NOT touch experienceRaw (would cause loop)
        await db.collection('vendors').doc(vendorId).update({
            'onboarding.experienceSummary': summary,
        });

        logger.info(`[ExperienceSummary] ${vendorId} — summary saved (${summary.length} chars)`);
    } catch (err: any) {
        logger.error(`[ExperienceSummary] ${vendorId} — Gemini call failed:`, err.message);
        // Non-fatal — don't throw; the raw text is still saved
    }
});
