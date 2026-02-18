"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";

interface EnrichButtonProps {
    collection?: 'leads' | 'vendors';
    documentId?: string;
    website: string;
    previewOnly?: boolean;
    onSuccess?: (data: any) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    size?: 'sm' | 'default' | 'lg';
    variant?: 'default' | 'outline' | 'ghost';
}

export function EnrichButton({
    collection,
    documentId,
    website,
    previewOnly = false,
    onSuccess,
    onError,
    disabled = false,
    size = 'sm',
    variant = 'outline',
}: EnrichButtonProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleEnrich = async () => {
        if (!website) {
            onError?.('No website URL provided');
            return;
        }

        setLoading(true);
        setStatus('idle');

        try {
            const functions = getFunctions();
            const enrichFromWebsite = httpsCallable(functions, 'enrichFromWebsite');

            const result = await enrichFromWebsite({
                collection: collection || 'leads',
                documentId: documentId || 'preview',
                website,
                previewOnly,
            });

            const data = result.data as any;

            if (data.success) {
                setStatus('success');
                onSuccess?.(data);
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
                onError?.(data.error || 'Enrichment failed');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (error: any) {
            console.error('Enrichment error:', error);
            setStatus('error');
            onError?.(error.message || 'Failed to enrich data');
            setTimeout(() => setStatus('idle'), 3000);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = () => {
        if (loading) return <Loader2 className="w-4 h-4 animate-spin" />;
        if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
        if (status === 'error') return <XCircle className="w-4 h-4 text-red-600" />;
        return <Sparkles className="w-4 h-4" />;
    };

    const getButtonText = () => {
        if (loading) return 'Enriching...';
        if (status === 'success') return 'Enriched!';
        if (status === 'error') return 'Failed';
        return 'Enrich';
    };

    return (
        <Button
            onClick={handleEnrich}
            disabled={disabled || loading || !website}
            size={size}
            variant={variant}
            className="gap-2"
            title={website ? 'Auto-fill missing contact info from website' : 'No website URL'}
        >
            {getIcon()}
            {getButtonText()}
        </Button>
    );
}
