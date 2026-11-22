import * as logger from 'firebase-functions/logger';

// Mapping from older/discontinued/invalid models to current active Gemini models.
const MODEL_MAPPING: Record<string, string> = {
    // Flash models → gemini-2.5-flash
    'gemini-1.0-flash': 'gemini-2.5-flash',
    'gemini-1.5-flash': 'gemini-2.5-flash',
    'gemini-2.0-flash': 'gemini-2.5-flash',
    'gemini-2.5-flash': 'gemini-2.5-flash',

    // Pro models → gemini-2.5-pro
    'gemini-1.0-pro': 'gemini-2.5-pro',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-pro': 'gemini-2.5-pro',
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-pro': 'gemini-2.5-pro',
};

/**
 * Resolves a requested Gemini model name to an active Gemini API model.
 * Can be overridden by the `GEMINI_MODEL` environment variable.
 */
export function resolveGeminiModel(requestedModel: string): string {
    if (process.env.GEMINI_MODEL) {
        return process.env.GEMINI_MODEL;
    }

    const cleanedName = requestedModel.toLowerCase().trim();

    if (MODEL_MAPPING[cleanedName]) {
        const targetModel = MODEL_MAPPING[cleanedName];
        if (targetModel !== cleanedName) {
            logger.debug(`[resolveGeminiModel] Mapped "${requestedModel}" -> "${targetModel}"`);
        }
        return targetModel;
    }

    if (cleanedName.includes('flash')) {
        return 'gemini-2.5-flash';
    }
    if (cleanedName.includes('pro') || cleanedName.includes('ultra')) {
        return 'gemini-2.5-pro';
    }

    return 'gemini-2.5-flash';
}
