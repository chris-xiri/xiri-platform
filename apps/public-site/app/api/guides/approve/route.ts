import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { SITE } from '@/lib/constants';

/**
 * POST /api/guides/approve?id=xxx&token=yyy
 *
 * One-click guide approval from the email link.
 * Verifies the approval token and publishes the guide.
 */
export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const guideId = searchParams.get('id');
    const token = searchParams.get('token');

    if (!guideId || !token) {
        return NextResponse.json(
            { error: 'Missing id or token parameter' },
            { status: 400 }
        );
    }

    try {
        const docRef = doc(db, 'guides', guideId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return NextResponse.json(
                { error: 'Guide not found' },
                { status: 404 }
            );
        }

        const data = docSnap.data();
        if (data.approvalToken !== token) {
            return NextResponse.json(
                { error: 'Invalid approval token' },
                { status: 403 }
            );
        }

        if (data.status === 'published') {
            return NextResponse.json(
                { message: 'Guide is already published', slug: data.slug },
                { status: 200 }
            );
        }

        await updateDoc(docRef, {
            status: 'published',
            publishedAt: serverTimestamp(),
        });

        return NextResponse.json({
            message: 'Guide published successfully!',
            slug: data.slug,
            url: `${SITE.url}/guides/${data.slug}`,
        });
    } catch (error) {
        console.error('Guide approval error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/guides/approve?id=xxx&token=yyy
 *
 * Handle approval link click from email — shows a simple confirmation page.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const guideId = searchParams.get('id');
    const token = searchParams.get('token');

    if (!guideId || !token) {
        return new NextResponse(renderHtml('Missing Parameters', 'The approval link is invalid.', 'error'), {
            headers: { 'Content-Type': 'text/html' },
        });
    }

    try {
        const docRef = doc(db, 'guides', guideId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return new NextResponse(renderHtml('Not Found', 'This guide does not exist.', 'error'), {
                headers: { 'Content-Type': 'text/html' },
            });
        }

        const data = docSnap.data();
        if (data.approvalToken !== token) {
            return new NextResponse(renderHtml('Unauthorized', 'Invalid approval token.', 'error'), {
                headers: { 'Content-Type': 'text/html' },
            });
        }

        if (data.status === 'published') {
            return new NextResponse(
                renderHtml(
                    'Already Published ✅',
                    `"${data.title}" is already live at <a href="https://xiri.ai/guides/${data.slug}" style="color:#0369a1">/guides/${data.slug}</a>`,
                    'success'
                ),
                { headers: { 'Content-Type': 'text/html' } }
            );
        }

        // Approve the guide
        await updateDoc(docRef, {
            status: 'published',
            publishedAt: serverTimestamp(),
        });

        return new NextResponse(
            renderHtml(
                'Guide Published! 🎉',
                `"${data.title}" is now live at <a href="https://xiri.ai/guides/${data.slug}" style="color:#0369a1">xiri.ai/guides/${data.slug}</a>`,
                'success'
            ),
            { headers: { 'Content-Type': 'text/html' } }
        );
    } catch (error) {
        return new NextResponse(renderHtml('Error', 'Something went wrong. Please try again.', 'error'), {
            headers: { 'Content-Type': 'text/html' },
        });
    }
}

function renderHtml(title: string, message: string, type: 'success' | 'error') {
    const bg = type === 'success' ? '#f0fdf4' : '#fef2f2';
    const accent = type === 'success' ? '#16a34a' : '#dc2626';
    return `<!DOCTYPE html>
<html lang="en">
<head><title>${title} — XIRI SEO Agent</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:${bg}">
<div style="text-align:center;padding:40px;max-width:500px">
<div style="width:64px;height:64px;background:${accent};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:white;font-size:28px">${type === 'success' ? '✓' : '✗'}</div>
<h1 style="color:#0f172a;font-size:28px;margin:0 0 12px">${title}</h1>
<p style="color:#475569;font-size:16px;line-height:1.6">${message}</p>
<a href=SITE.url style="display:inline-block;margin-top:24px;padding:12px 24px;background:#0369a1;color:white;border-radius:8px;text-decoration:none;font-weight:600">Back to XIRI</a>
</div></body></html>`;
}
