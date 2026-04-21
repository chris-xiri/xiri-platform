'use client';

import { UnifiedCalculator } from '../../../packages/calculator-ui/src/unified-calculator';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface PublicCalculatorProps {
    mode?: 'client' | 'contractor';
}

export default function PublicCalculator({ mode = 'client' }: PublicCalculatorProps) {
    const parseWithAi = async (prompt: string) => {
        if (!prompt?.trim()) return null;
        const functions = getFunctions(app, 'us-central1');
        const parseCalculatorPrompt = httpsCallable<
            { prompt: string },
            { parsed?: Record<string, unknown> }
        >(functions, 'parseCalculatorPrompt');
        const result = await parseCalculatorPrompt({ prompt });
        return (result.data?.parsed as Record<string, unknown>) ?? null;
    };

    return (
        <UnifiedCalculator
            mode={mode}
            onAiParsePrompt={parseWithAi}
        />
    );
}
