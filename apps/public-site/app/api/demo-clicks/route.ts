import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Initialize Firebase client (reuse if already initialized)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { painPoint, sessionId } = body;

        if (!painPoint) {
            return NextResponse.json({ error: 'painPoint required' }, { status: 400 });
        }

        const ua = req.headers.get('user-agent') || '';
        const referer = req.headers.get('referer') || '';
        const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

        await addDoc(collection(db, 'demo_clicks'), {
            painPoint,
            sessionId: sessionId || null,
            userAgent: ua,
            referer,
            ip: forwarded.split(',')[0]?.trim() || null,
            createdAt: serverTimestamp(),
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('demo-clicks error:', err);
        return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
}
