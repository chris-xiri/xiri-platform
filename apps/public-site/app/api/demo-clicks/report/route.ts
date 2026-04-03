import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

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

const GCHAT_WEBHOOK = "https://chat.googleapis.com/v1/spaces/AAQA5xbduUw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=3oOtBqJMN61HDSZRB-6_SD6JhHHLJSmQlKQq3g42R7I";

const PAIN_LABELS: Record<string, string> = {
    'inconsistent': '🔍 Inconsistent cleaning quality',
    'late-noshow': '⏰ No-shows or late arrivals',
    'poor-comms': '📢 Poor communication',
    'turnover': '🔄 Crew turnover & reliability',
};

export async function GET(req: NextRequest) {
    try {
        // Optional: restrict with a secret
        const auth = req.nextUrl.searchParams.get('key');
        if (process.env.DEMO_REPORT_KEY && auth !== process.env.DEMO_REPORT_KEY) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        // Default: last 7 days
        const daysBack = parseInt(req.nextUrl.searchParams.get('days') || '7', 10);
        const since = Timestamp.fromDate(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));

        const q = query(
            collection(db, 'demo_clicks'),
            where('createdAt', '>=', since)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            // Still send a chat message so you know it ran
            await fetch(GCHAT_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: `📊 Demo Pain Point Report (${daysBack}d): No clicks recorded in the last ${daysBack} days.`,
                }),
            });
            return NextResponse.json({ message: 'No clicks in period', sent: true });
        }

        // Aggregate
        const totals: Record<string, number> = {};
        const uniqueSessions = new Set<string>();

        snap.forEach(doc => {
            const d = doc.data();
            const pp = d.painPoint || 'unknown';
            totals[pp] = (totals[pp] || 0) + 1;
            if (d.sessionId) uniqueSessions.add(d.sessionId);
        });

        const totalClicks = snap.size;
        const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);

        // Build the breakdown text
        const breakdownLines = sorted.map(([pp, count]) => {
            const pct = Math.round((count / totalClicks) * 100);
            const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
            return `${PAIN_LABELS[pp] || pp}\n${bar}  *${count}* clicks (${pct}%)`;
        });

        // Top pain point
        const topPain = sorted[0];
        const topLabel = PAIN_LABELS[topPain[0]] || topPain[0];

        const chatCard = {
            header: {
                title: "📊 Demo Pain Point Report",
                subtitle: `Last ${daysBack} days · ${totalClicks} clicks · ${uniqueSessions.size} unique visitors`,
                imageUrl: "https://xiri.ai/icon.png",
                imageType: "CIRCLE",
            },
            sections: [
                {
                    header: "Pain Point Breakdown",
                    widgets: breakdownLines.map(line => ({
                        textParagraph: { text: line },
                    })),
                },
                {
                    header: "Key Insight",
                    widgets: [
                        {
                            textParagraph: {
                                text: `🏆 <b>#1 Pain Point:</b> ${topLabel}\n${topPain[1]} of ${totalClicks} visitors (${Math.round((topPain[1] / totalClicks) * 100)}%) chose this as their biggest frustration.\n\nThis is your strongest market signal — lean into this in sales conversations and landing page copy.`,
                            },
                        },
                    ],
                },
                {
                    widgets: [
                        {
                            buttonList: {
                                buttons: [
                                    {
                                        text: "🔗 View Demo Page",
                                        onClick: { openLink: { url: "https://xiri.ai/demo" } },
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        };

        const chatResp = await fetch(GCHAT_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `Demo Pain Point Report (${daysBack}d): ${totalClicks} clicks, top = ${topLabel}`,
                cardsV2: [{ cardId: `demo-report-${Date.now()}`, card: chatCard }],
            }),
        });

        if (!chatResp.ok) {
            const errText = await chatResp.text();
            console.error(`Google Chat webhook failed (${chatResp.status}):`, errText);
            return NextResponse.json({ error: 'webhook failed', detail: errText }, { status: 502 });
        }

        return NextResponse.json({
            sent: true,
            totalClicks,
            uniqueVisitors: uniqueSessions.size,
            breakdown: totals,
        });
    } catch (err) {
        console.error('demo-clicks report error:', err);
        return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
}
