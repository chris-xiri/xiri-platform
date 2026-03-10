'use client';

import { useEffect } from 'react';
import clarity from '@microsoft/clarity';

const CLARITY_PROJECT_ID = 'vtpukex31u';

export function ClarityProvider() {
    useEffect(() => {
        clarity.init(CLARITY_PROJECT_ID);
    }, []);

    return null;
}
