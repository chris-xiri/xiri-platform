import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (reuse if already initialized)
if (!getApps().length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
        initializeApp();
    } else {
        // Local dev — uses ADC or emulator
        initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'xiri-app' });
    }
}

const db = getFirestore();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { painPoint, sessionId } = body;

        if (!painPoint) {
            return NextResponse.json({ error: 'painPoint required' }, { status: 400 });
        }

        // Grab useful metadata
        const ua = req.headers.get('user-agent') || '';
        const referer = req.headers.get('referer') || '';
        const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

        await db.collection('demo_clicks').add({
            painPoint,
            sessionId: sessionId || null,
            userAgent: ua,
            referer,
            ip: forwarded.split(',')[0]?.trim() || null,
            createdAt: new Date(),
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('demo-clicks error:', err);
        return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
}
