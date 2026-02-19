'use client';

import { Suspense } from 'react';
import ConductVisitFlow from './ConductVisitFlow';

export default function ConductVisitPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        }>
            <ConductVisitFlow />
        </Suspense>
    );
}
