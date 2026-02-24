import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * AI Template Optimizer
 *
 * Analyzes email template performance stats and uses Gemini
 * to suggest improved subject lines and body copy.
 *
 * Can be triggered:
 * 1. On a weekly schedule (auto-checks underperformers)
 * 2. On-demand via callable from admin UI
 */

// ─── Weekly Auto-Check ───────────────────────────────────────────
export const weeklyTemplateOptimizer = onSchedule({
    schedule: "every monday 09:00",
    timeZone: "America/New_York",
    secrets: ["GEMINI_API_KEY"],
    memory: '512MiB',
}, async () => {
    logger.info("Running weekly template optimization check...");
    await optimizeUnderperformingTemplates();
});

// ─── On-Demand from Admin ────────────────────────────────────────
export const optimizeTemplate = onCall({
    secrets: ["GEMINI_API_KEY"],
    memory: '512MiB',
}, async (request) => {
    // Only admins can trigger this
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const templateId = request.data?.templateId;

    if (templateId) {
        // Optimize specific template
        const result = await optimizeSingleTemplate(templateId);
        return result;
    } else {
        // Optimize all underperformers
        const results = await optimizeUnderperformingTemplates();
        return { optimized: results };
    }
});

// ─── Core Logic ──────────────────────────────────────────────────

const MIN_SENDS_FOR_ANALYSIS = 10; // Need at least 10 sends for meaningful data
const LOW_OPEN_RATE_THRESHOLD = 0.30; // < 30% = underperforming

async function optimizeUnderperformingTemplates(): Promise<string[]> {
    const templatesSnap = await db.collection('templates')
        .where('category', '==', 'vendor')
        .get();

    const optimized: string[] = [];

    for (const doc of templatesSnap.docs) {
        const template = doc.data();
        const stats = template.stats;

        if (!stats || stats.sent < MIN_SENDS_FOR_ANALYSIS) continue;

        const openRate = stats.sent > 0 ? stats.opened / stats.sent : 0;

        if (openRate < LOW_OPEN_RATE_THRESHOLD) {
            logger.info(`Template ${doc.id}: ${(openRate * 100).toFixed(1)}% open rate — optimizing`);
            await optimizeSingleTemplate(doc.id);
            optimized.push(doc.id);
        }
    }

    if (optimized.length === 0) {
        logger.info("No underperforming templates found.");
    }

    return optimized;
}

async function optimizeSingleTemplate(templateId: string) {
    const templateDoc = await db.collection('templates').doc(templateId).get();
    if (!templateDoc.exists) {
        throw new HttpsError('not-found', `Template ${templateId} not found`);
    }

    const template = templateDoc.data()!;
    const stats = template.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 'N/A';
    const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : 'N/A';
    const bounceRate = stats.sent > 0 ? ((stats.bounced / stats.sent) * 100).toFixed(1) : 'N/A';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set');
    }

    const prompt = `You are an email marketing expert specializing in B2B contractor outreach for facility management companies.

## Current Template Performance
- Template: "${template.name}" (${templateId})
- Sent: ${stats.sent} | Delivered: ${stats.delivered} | Opened: ${stats.opened} | Clicked: ${stats.clicked}
- Open Rate: ${openRate}% | Click Rate: ${clickRate}% | Bounce Rate: ${bounceRate}%

## Current Subject Line
"${template.subject}"

## Current Email Body
${template.body}

## Context
This email targets independent contractors (janitorial, HVAC, cleaning, etc.) to join a facility management network. The CTA is to click a link and complete an onboarding profile. These are small business owners or independent operators — keep tone professional but blue-collar-friendly.

## Available Merge Variables
{{vendorName}}, {{contactName}}, {{city}}, {{state}}, {{services}}, {{specialty}}, {{onboardingUrl}}

## Instructions
Based on the performance data, suggest improvements. Return your response as JSON:
{
  "analysis": "Brief analysis of why this template may be underperforming",
  "suggestions": [
    {
      "subject": "Improved subject line option 1",
      "body": "Improved email body option 1 (keep merge variables, keep it concise)",
      "rationale": "Why this version should perform better"
    },
    {
      "subject": "Improved subject line option 2",
      "body": "Improved email body option 2",
      "rationale": "Why this version should perform better"
    }
  ],
  "shortUrlTest": {
    "recommendation": "Whether to test short vs long onboarding URL display",
    "shortVariant": "Suggested short CTA text and link format if applicable"
  }
}

Return ONLY valid JSON, no markdown fences.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                    },
                }),
            }
        );

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            logger.error('No response from Gemini for template optimization');
            throw new HttpsError('internal', 'Gemini returned empty response');
        }

        // Parse JSON (strip markdown fences if present)
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const suggestions = JSON.parse(cleanText);

        // Store suggestions on the template
        await db.collection('templates').doc(templateId).update({
            aiSuggestions: admin.firestore.FieldValue.arrayUnion({
                ...suggestions,
                generatedAt: new Date(),
                performanceSnapshot: stats,
            }),
            lastOptimizedAt: new Date(),
        });

        logger.info(`Template ${templateId}: AI suggestions stored (${suggestions.suggestions?.length || 0} variants)`);

        return {
            templateId,
            analysis: suggestions.analysis,
            suggestionsCount: suggestions.suggestions?.length || 0,
            shortUrlTest: suggestions.shortUrlTest,
        };
    } catch (err) {
        logger.error(`AI optimization failed for ${templateId}:`, err);
        throw new HttpsError('internal', `AI optimization failed: ${err}`);
    }
}
