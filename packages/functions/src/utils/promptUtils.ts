/**
 * Shared utility for fetching AI prompts from Firestore.
 * All Gemini prompts live in the `prompts` collection.
 * 
 * Usage:
 *   const content = await getPrompt('onboarding_classifier');
 *   // Returns the prompt content string, or the fallback if not found.
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

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
