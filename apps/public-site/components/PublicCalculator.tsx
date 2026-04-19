'use client';

import { UnifiedCalculator } from '../../../packages/calculator-ui/src/unified-calculator';
import type { ContractorCapturePayload } from '../../../packages/calculator-ui/src/unified-calculator';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PublicCalculatorProps {
    mode?: 'client' | 'contractor';
}

export default function PublicCalculator({ mode = 'client' }: PublicCalculatorProps) {
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

    return <UnifiedCalculator mode={mode} onContractorCapture={mode === 'contractor' ? handleContractorCapture : undefined} />;
}
