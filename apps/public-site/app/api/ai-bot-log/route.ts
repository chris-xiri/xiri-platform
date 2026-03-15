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

interface BotVisitPayload {
    bot: string;
    org: string;
    path: string;
    query: string;
    userAgent: string;
    timestamp: string;
    ip: string;
}

export async function POST(request: NextRequest) {
    try {
        const payload: BotVisitPayload = await request.json();

        await addDoc(collection(db, 'aiBotVisits'), {
            ...payload,
            createdAt: serverTimestamp(),
            date: payload.timestamp.split('T')[0], // YYYY-MM-DD for easy querying
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[AI Bot Log] Error logging visit:', error);
        return NextResponse.json({ ok: false, error: 'Failed to log' }, { status: 500 });
    }
}
