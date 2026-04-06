import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { getPrompt } from "../utils/promptUtils";

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

// All template categories the optimizer should check
const OPTIMIZABLE_CATEGORIES = ['vendor', 'tenant_lead', 'referral_partnership', 'enterprise_lead'];

async function optimizeUnderperformingTemplates(): Promise<string[]> {
    const optimized: string[] = [];

    for (const category of OPTIMIZABLE_CATEGORIES) {
        const templatesSnap = await db.collection('templates')
            .where('category', '==', category)
            .get();

        for (const doc of templatesSnap.docs) {
            const template = doc.data();
            const stats = template.stats;

            if (!stats || stats.sent < MIN_SENDS_FOR_ANALYSIS) continue;

            const openRate = stats.sent > 0 ? stats.opened / stats.sent : 0;

            if (openRate < LOW_OPEN_RATE_THRESHOLD) {
                logger.info(`Template ${doc.id} (${category}): ${(openRate * 100).toFixed(1)}% open rate — optimizing`);
                await optimizeSingleTemplate(doc.id);
                optimized.push(doc.id);
            }
        }
    }

    // Write notification if any templates were optimized
    if (optimized.length > 0) {
        await db.collection('notifications').add({
            type: 'AI_TEMPLATE_OPTIMIZATION',
            title: `AI optimized ${optimized.length} template${optimized.length > 1 ? 's' : ''}`,
            message: `${optimized.length} underperforming template${optimized.length > 1 ? 's have' : ' has'} new AI suggestions ready for your review.`,
            templateIds: optimized,
            read: false,
            createdAt: new Date(),
        });
        logger.info(`Notification created for ${optimized.length} optimized templates.`);
    } else {
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

    // ── Category-aware prompt context ────────────────────────────
    // Each template category targets a different audience with different
    // merge variables. Using the wrong context causes the AI to generate
    // copy for the wrong audience (e.g. contractor copy for tenants).
    const category = template.category || 'vendor';

    const CATEGORY_CONFIG: Record<string, { role: string; context: string; mergeVars: string }> = {
        vendor: {
            role: 'B2B contractor outreach for facility management companies',
            context: 'This email targets independent contractors (janitors, cleaners, handymen) to join a facility management network as service providers. Keep tone professional but blue-collar-friendly. The goal is to get them to create a profile and join the XIRI contractor network.',
            mergeVars: '{{vendorName}}, {{contactName}}, {{city}}, {{state}}, {{services}}, {{specialty}}, {{onboardingUrl}}',
        },
        tenant_lead: {
            role: 'B2B facility services sales to commercial tenants and medical practices',
            context: 'This email targets office managers, practice managers, and facility decision-makers at commercial tenants and medical practices. We are selling XIRI facility management services TO them — cleaning, maintenance, supplies, compliance. Keep tone professional and consultative. The goal is to book a 10-minute introductory call or demo. Do NOT write copy that recruits contractors or asks them to join a network — these are potential CLIENTS, not service providers.',
            mergeVars: '{{contactName}}, {{businessName}}, {{facilityType}}, {{address}}, {{squareFootage}}',
        },
        enterprise_lead: {
            role: 'B2B enterprise facility services sales to large organizations',
            context: 'This email targets enterprise facility directors and operations managers at large organizations (urgent care groups, hospital networks, corporate offices). We are selling XIRI facility management services TO them. Keep tone polished and executive-level. The goal is to book a meeting or demo. Do NOT write contractor recruitment copy.',
            mergeVars: '{{contactName}}, {{businessName}}, {{facilityType}}, {{address}}, {{squareFootage}}',
        },
        referral_partnership: {
            role: 'B2B referral partnership outreach for facility management',
            context: 'This email targets potential referral partners (real estate brokers, property managers, medical equipment suppliers) who could refer facility management clients to XIRI. Keep tone collaborative and partnership-focused. The goal is to establish a mutual referral relationship.',
            mergeVars: '{{contactName}}, {{businessName}}, {{facilityType}}',
        },
    };

    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['vendor'];

    const FALLBACK = `You are an email marketing expert specializing in ${config.role}.

## Current Template Performance
- Template: "{{templateName}}" ({{templateId}})
- Category: {{templateCategory}}
- Sent: {{statsSent}} | Delivered: {{statsDelivered}} | Opened: {{statsOpened}} | Clicked: {{statsClicked}}
- Open Rate: {{openRate}}% | Click Rate: {{clickRate}}% | Bounce Rate: {{bounceRate}}%

## Current Subject Line
"{{currentSubject}}"

## Current Email Body
{{currentBody}}

## Context
${config.context}

## Available Merge Variables (ONLY use these — do NOT invent others)
${config.mergeVars}

## CRITICAL RULES
1. ONLY use merge variables from the list above. Do NOT use variables from other template categories.
2. Write copy appropriate for the target audience described in Context. Do NOT mix up audiences.
3. If this is a tenant/enterprise lead template, never mention "joining a network", "onboarding profile", or "getting more jobs" — those are contractor concepts.

## Instructions
Return improvements as JSON with analysis, suggestions[], and shortUrlTest. Return ONLY valid JSON, no markdown fences.`;

    const prompt = await getPrompt('template_optimizer', FALLBACK, {
        templateName: template.name,
        templateId,
        templateCategory: category,
        statsSent: String(stats.sent),
        statsDelivered: String(stats.delivered),
        statsOpened: String(stats.opened),
        statsClicked: String(stats.clicked),
        openRate: String(openRate),
        clickRate: String(clickRate),
        bounceRate: String(bounceRate),
        currentSubject: template.subject,
        currentBody: template.body,
    });

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
