import { NextRequest, NextResponse } from 'next/server';

const BREEZEDOC_API_BASE = 'https://breezedoc.com/api';

function getApiKey(): string {
    const key = process.env.BREEZEDOC_API_KEY;
    if (!key) {
        throw new Error('BREEZEDOC_API_KEY is not configured.');
    }
    return key;
}

export async function GET(req: NextRequest) {
    try {
        const apiKey = getApiKey();
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action') || 'documents';
        const docId = searchParams.get('id');

        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        if (action === 'me') {
            const res = await fetch(`${BREEZEDOC_API_BASE}/me`, { headers });
            const data = await res.json();
            return NextResponse.json({ success: true, data });
        }

        if (action === 'document' && docId) {
            const res = await fetch(`${BREEZEDOC_API_BASE}/documents/${docId}`, { headers });
            const data = await res.json();
            return NextResponse.json({ success: true, data });
        }

        if (action === 'templates') {
            const res = await fetch(`${BREEZEDOC_API_BASE}/templates`, { headers });
            const data = await res.json();
            return NextResponse.json({ success: true, data });
        }

        // Default: list documents
        const page = searchParams.get('page') || '1';
        const res = await fetch(`${BREEZEDOC_API_BASE}/documents?page=${page}`, { headers });
        const data = await res.json();
        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('BreezeDoc API error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
