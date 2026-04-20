'use client';

import { UnifiedCalculator } from '../../../packages/calculator-ui/src/unified-calculator';
import type { ContractorCapturePayload } from '../../../packages/calculator-ui/src/unified-calculator';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
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

    const handleContractorCapture = async (payload: ContractorCapturePayload) => {
        if (!payload.email) return;
        await addDoc(collection(db, 'vendors'), {
            status: 'new',
            source: 'calculator_contractor',
            email: payload.email,
            name: payload.name || '',
            businessName: payload.company || '',
            phone: payload.phone || '',
            state: payload.state,
            contractorCounty: payload.county,
            routing: {
                funnel: payload.inArea ? 'managed_service' : 'xiri_os',
                destination: payload.inArea ? payload.onboardingUrl : payload.osUrl,
            },
            calculatorData: {
                state: payload.state,
                facilityType: payload.buildingTypeId,
                sqft: payload.sqft,
                daysPerWeek: Number(payload.frequency),
                monthlyEstimate: payload.estimate,
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    };

    return (
        <UnifiedCalculator
            mode={mode}
            onAiParsePrompt={parseWithAi}
            onContractorCapture={mode === 'contractor' ? handleContractorCapture : undefined}
        />
    );
}
