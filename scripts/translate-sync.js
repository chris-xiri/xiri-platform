#!/usr/bin/env node
/**
 * AI-Powered Translation Sync Script
 * 
 * This script uses Google Gemini to automatically translate new English text to Spanish
 * when the translation file is updated.
 * 
 * Usage:
 *   npm run translate:sync
 * 
 * How it works:
 * 1. Reads the English translations
 * 2. Compares with Spanish translations
 * 3. Identifies missing or outdated Spanish translations
 * 4. Uses Google Gemini to translate with cultural context
 * 5. Updates the translation file
 * 6. Creates a review file for human verification
 * 
 * IMPORTANT: Always review AI translations before deploying!
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini (requires GEMINI_API_KEY in environment)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
6. Return ONLY the Spanish translation, no explanations

Translation:`;

async function translateText(text) {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.3, // Lower temperature for more consistent translations
                maxOutputTokens: 500,
            }
        });

        const prompt = TRANSLATION_PROMPT.replace('{text}', text);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translation = response.text().trim();

        return translation;
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

    // Check for Gemini API key
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ Error: GEMINI_API_KEY environment variable not set');
        console.log('   Set it in packages/functions/.env or your shell:');
        console.log('   export GEMINI_API_KEY=your-api-key\n');
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
    reviewContent += `Generated: ${new Date().toISOString()}\n`;
    reviewContent += `Model: Google Gemini 1.5 Flash\n\n`;
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

        // Read the file again to be sure
        let content = fs.readFileSync(TRANSLATIONS_FILE, 'utf-8');

        // Find the end of the 'es' object
        // We look for "es: {" and then find the closing brace before "};"
        // This is a simple heuristic - assuming the file structure matches the regex
        const esStartMatch = content.match(/es:\s*\{/);
        if (esStartMatch) {
            const esStartIndex = esStartMatch.index + esStartMatch[0].length;

            // We need to insert the new keys before the closing brace of the 'es' object
            // For simplicity, we'll append them at the end of the object
            // Finding the closing brace is tricky without a parser, but we can look for the last "  }" before "};"
            // or just append to the 'es' object string we extracted earlier and replace the whole block

            const { es: currentEsBlock } = extractTranslations(content);
            let newEsBlock = currentEsBlock.trimEnd(); // Remove trailing spaces/newlines

            // Generate the new lines to add
            const newLines = Object.entries(translations).map(([key, value]) => {
                return `        ${key}: "${value}"`; // Indentation assumption: 8 spaces
            }).join(',\n');

            if (newEsBlock.endsWith(',')) {
                newEsBlock += '\n' + newLines;
            } else {
                newEsBlock += ',\n' + newLines;
            }

            // Replace the old es block with the new one in the file content
            // We use the exact string match from extraction
            // Note: This relies on extractTranslations returning the exact substring

            // Alternative: Insert before the last closing brace of the es object
            // Let's assume the standard formatting:
            // es: {
            //    ...
            // }
            // };

            const closingBraceIndex = content.lastIndexOf('    }'); // Assuming indentation
            if (closingBraceIndex !== -1) {
                // Insert before the closing brace
                // Check if we need a comma for the previous item
                // This is getting complicated to do safely with regex. 

                // Let's go with a safer manual instruction approach for now to avoid breaking the file
                // OR use a placeholder if we can controls the file format.

                // Better approach: Re-construct the file? No, too risky.

                console.log('   (Auto-apply logic is complex for TS files. Appending to review file instead.)');
                console.log('   Please copy-paste from review file or manually add to translations.ts');
            }

            // Let's try to inject it simply if we can find the "es: {" block
            const esBlockRegex = /(es:\s*\{[\s\S]*?)(\n\s*\}\s*;)/;
            const match = content.match(esBlockRegex);
            if (match) {
                const [fullMatch, beforeClosing, closing] = match;
                // Check if `beforeClosing` ends with comma
                const trimmedBefore = beforeClosing.trimEnd();
                const needsComma = !trimmedBefore.endsWith(',') && !trimmedBefore.endsWith('{');

                const insertion = (needsComma ? ',' : '') + '\n' + newLines;
                const newContent = content.replace(esBlockRegex, beforeClosing + insertion + closing);

                fs.writeFileSync(TRANSLATIONS_FILE, newContent);
                console.log('✅ Updated translations.ts successfully!');
            } else {
                console.error('❌ Could not safe-patch the file. Please modify manually.');
            }
        }
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
