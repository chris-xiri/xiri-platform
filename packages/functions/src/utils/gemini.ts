import * as logger from 'firebase-functions/logger';

// Mapping from older/discontinued/invalid models to modern active replacements.
const MODEL_MAPPING: Record<string, string> = {
    // Flash models map to gemini-2.5-flash
    'gemini-1.0-flash': 'gemini-2.5-flash',
    'gemini-1.5-flash': 'gemini-2.5-flash',
    'gemini-2.5-flash': 'gemini-2.5-flash',
    'gemini-2.5-flash': 'gemini-2.5-flash',
    'gemini-3.0-flash': 'gemini-2.5-flash',
    'gemini-3.5-flash': 'gemini-2.5-flash',

    // Pro/Ultra/Preview models map to gemini-2.5-pro
    'gemini-1.0-pro': 'gemini-2.5-pro',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-pro': 'gemini-2.5-pro',
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-3.0-pro': 'gemini-2.5-pro',
    'gemini-3.5-pro': 'gemini-2.5-pro',
    'gemini-3.1-pro-preview': 'gemini-2.5-pro',
    'gemini-pro': 'gemini-2.5-pro',
};

/**
 * Dynamically maps older or discontinued Gemini models to their most similar active counterparts,
 * prioritizing gemini-2.5-flash and gemini-2.5-pro.
 * 
 * Can be overridden by the `GEMINI_MODEL` environment variable.
 */
export function resolveGeminiModel(requestedModel: string): string {
    // If an environment override is explicitly set, prioritize that
    if (process.env.GEMINI_MODEL) {
        return process.env.GEMINI_MODEL;
    }

    const cleanedName = requestedModel.toLowerCase().trim();

    if (MODEL_MAPPING[cleanedName]) {
        const targetModel = MODEL_MAPPING[cleanedName];
        logger.debug(`[resolveGeminiModel] Dynamic upgrade: "${requestedModel}" mapped to "${targetModel}"`);
        return targetModel;
    }

    // Fallbacks based on pattern if not explicitly matched
    if (cleanedName.includes('flash')) {
        return 'gemini-2.5-flash';
    }
    if (cleanedName.includes('pro') || cleanedName.includes('ultra') || cleanedName.includes('preview')) {
        return 'gemini-2.5-pro';
    }

    // Default fallback if we can't determine the type
    return 'gemini-2.5-flash';
}
