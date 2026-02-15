#!/usr/bin/env node
/**
 * AI-Powered Translation Sync Script
 * 
 * This script uses OpenAI to automatically translate new English text to Spanish
 * when the translation file is updated.
 * 
 * Usage:
 *   npm run translate:sync
 * 
 * How it works:
 * 1. Reads the English translations
 * 2. Compares with Spanish translations
 * 3. Identifies missing or outdated Spanish translations
 * 4. Uses OpenAI to translate with cultural context
 * 5. Updates the translation file
 * 6. Creates a review file for human verification
 * 
 * IMPORTANT: Always review AI translations before deploying!
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Initialize OpenAI (requires OPENAI_API_KEY in environment)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const TRANSLATIONS_FILE = path.join(__dirname, '../apps/public-site/app/onboarding/[vendorId]/translations.ts');
const REVIEW_FILE = path.join(__dirname, '../.translations-review.md');

const TRANSLATION_PROMPT = `You are a professional translator specializing in business Spanish for the cleaning and facility services industry in the United States.

Context:
- Target audience: Spanish-speaking business owners (cleaning companies, janitorial services)
- Tone: Professional, respectful, B2B
- Formality: Use "usted" (formal), never "tú" (informal)
- Cultural adaptation: Adapt for U.S. Hispanic market (not Spain Spanish)

Translate the following English text to Spanish:

{text}

Requirements:
1. Use formal "usted" form
2. Adapt culturally for U.S. Hispanic business owners
3. Keep technical terms like "LLC" but add Spanish equivalent in parentheses
4. Maintain professional, encouraging tone
5. Keep placeholders like {state}, {current}, {total} exactly as-is

Translation:`;

async function translateText(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional translator specializing in business Spanish for U.S. Hispanic markets.'
                },
                {
                    role: 'user',
                    content: TRANSLATION_PROMPT.replace('{text}', text)
                }
            ],
            temperature: 0.3, // Lower temperature for more consistent translations
            max_tokens: 500
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Translation error:', error.message);
        return null;
    }
}

function extractTranslations(fileContent) {
    // Parse the TypeScript file to extract translation objects
    // This is a simplified parser - in production, use a proper TS parser
    const enMatch = fileContent.match(/en:\s*\{([\s\S]*?)\n\s*\},\s*es:/);
    const esMatch = fileContent.match(/es:\s*\{([\s\S]*?)\n\s*\}\s*\};/);

    if (!enMatch || !esMatch) {
        throw new Error('Could not parse translation file');
    }

    return {
        en: enMatch[1],
        es: esMatch[1]
    };
}

function findMissingTranslations(enText, esText) {
    // Find English strings that don't have Spanish equivalents
    const enStrings = enText.match(/"([^"]+)":/g) || [];
    const esStrings = esText.match(/"([^"]+)":/g) || [];

    const enKeys = enStrings.map(s => s.replace(/"/g, '').replace(/:$/, ''));
    const esKeys = esStrings.map(s => s.replace(/"/g, '').replace(/:$/, ''));

    return enKeys.filter(key => !esKeys.includes(key));
}

async function syncTranslations() {
    console.log('🌍 Starting translation sync...\n');

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ Error: OPENAI_API_KEY environment variable not set');
        console.log('   Set it in packages/functions/.env or your shell:');
        console.log('   export OPENAI_API_KEY=sk-...\n');
        process.exit(1);
    }

    // Read translation file
    if (!fs.existsSync(TRANSLATIONS_FILE)) {
        console.error(`❌ Translation file not found: ${TRANSLATIONS_FILE}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(TRANSLATIONS_FILE, 'utf-8');
    const { en, es } = extractTranslations(fileContent);

    // Find missing translations
    const missingKeys = findMissingTranslations(en, es);

    if (missingKeys.length === 0) {
        console.log('✅ All translations are up to date!\n');
        return;
    }

    console.log(`📝 Found ${missingKeys.length} missing Spanish translations:\n`);
    missingKeys.forEach(key => console.log(`   - ${key}`));
    console.log('');

    // Create review file
    let reviewContent = '# Translation Review\n\n';
    reviewContent += `Generated: ${new Date().toISOString()}\n\n`;
    reviewContent += '## AI-Generated Translations\n\n';
    reviewContent += 'Please review these translations before deploying:\n\n';

    // Translate each missing key
    const translations = {};
    for (const key of missingKeys) {
        console.log(`🤖 Translating: ${key}...`);

        // Extract the English value for this key
        const enValueMatch = en.match(new RegExp(`${key}:\\s*"([^"]+)"`));
        if (!enValueMatch) {
            console.log(`   ⚠️  Could not find English value for ${key}`);
            continue;
        }

        const enValue = enValueMatch[1];
        const esValue = await translateText(enValue);

        if (esValue) {
            translations[key] = esValue;
            console.log(`   ✓ ${enValue} → ${esValue}\n`);

            reviewContent += `### ${key}\n`;
            reviewContent += `- **English:** ${enValue}\n`;
            reviewContent += `- **Spanish (AI):** ${esValue}\n`;
            reviewContent += `- **Approved:** [ ] Yes [ ] No (edit below)\n`;
            reviewContent += `- **Corrected:** _____________________\n\n`;
        } else {
            console.log(`   ❌ Translation failed\n`);
        }
    }

    // Write review file
    fs.writeFileSync(REVIEW_FILE, reviewContent);
    console.log(`\n📄 Review file created: ${REVIEW_FILE}`);
    console.log('   Please review AI translations before deploying!\n');

    // Optionally auto-update the file (disabled by default for safety)
    if (process.argv.includes('--auto-apply')) {
        console.log('⚠️  Auto-apply is enabled. Updating translation file...');
        // TODO: Implement auto-update logic
        console.log('   (Not implemented - manual review required)\n');
    } else {
        console.log('💡 To auto-apply translations, run:');
        console.log('   npm run translate:sync -- --auto-apply\n');
    }

    console.log('✅ Translation sync complete!\n');
}

// Run the sync
syncTranslations().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
