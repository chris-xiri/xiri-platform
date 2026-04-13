/**
 * ─── pSEO Engine – GSC / GA4 OAuth Flow ───────────────────────────────────────
 *
 * Handles the OAuth 2.0 authorization code flow for Google Search Console
 * and Google Analytics 4 APIs.
 *
 * Flow:
 *   1. Dashboard calls `getGscAuthUrl()` → returns Google consent URL
 *   2. User authorizes → redirected back to dashboard with ?code=xxx
 *   3. Dashboard calls `exchangeGscToken({ code })` → tokens stored in Firestore
 *   4. Subsequent API calls use stored tokens (auto-refreshed)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { db, admin } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";

// ── Constants ────────────────────────────────────────────────────────────────

const gscClientId = defineSecret("GSC_CLIENT_ID");
const gscClientSecret = defineSecret("GSC_CLIENT_SECRET");
const REDIRECT_URI_PROD = "https://app.xiri.ai/admin/seo-engine";
const REDIRECT_URI_DEV = "http://localhost:3001/admin/seo-engine";

const SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",   // Search Console
    "https://www.googleapis.com/auth/analytics.readonly",     // GA4
    "openid",                                                 // Required for userinfo
    "email",                                                  // Get connected user email
].join(" ");

const TOKEN_DOC_PATH = "pseo_config/gsc_credentials";

// ── Helper: Build OAuth URL ──────────────────────────────────────────────────

function getRedirectUri(isDev: boolean): string {
    return isDev ? REDIRECT_URI_DEV : REDIRECT_URI_PROD;
}

// ── 1. Get Auth URL (dashboard calls this to initiate consent) ──────────────

export const getGscAuthUrl = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 10,
    secrets: [gscClientId],
}, async (request) => {
    const isDev = request.data?.isDev === true;
    const redirectUri = getRedirectUri(isDev);

    const params = new URLSearchParams({
        client_id: gscClientId.value(),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",  // Always show consent to get refresh token
        state: "pseo-connect",
    });

    return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
});

// ── 2. Exchange Auth Code for Tokens ────────────────────────────────────────

export const exchangeGscToken = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
    secrets: [gscClientId, gscClientSecret],
}, async (request) => {
    const code = request.data?.code as string;
    const isDev = request.data?.isDev === true;

    if (!code) {
        throw new HttpsError("invalid-argument", "Missing authorization code");
    }

    const redirectUri = getRedirectUri(isDev);

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: gscClientId.value(),
            client_secret: gscClientSecret.value(),
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
        console.error("[pSEO] Token exchange failed:", tokenData);
        throw new HttpsError("internal", `Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    // Calculate expiry as a Firestore Timestamp
    const expiresAt = admin.firestore.Timestamp.fromMillis(
        Date.now() + (tokenData.expires_in * 1000)
    );

    // Fetch connected user info for display
    let userEmail = "unknown";
    try {
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email || "unknown";
    } catch (err) {
        console.warn("[pSEO] Could not fetch user info:", err);
    }

    // Store tokens securely in Firestore
    const credentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: expiresAt,
        siteUrl: "https://xiri.ai/",  // URL-prefix property
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedBy: request.auth?.uid || "system",
        connectedEmail: userEmail,
    };

    await db.doc(TOKEN_DOC_PATH).set(credentials, { merge: true });

    console.log(`[pSEO] GSC/GA4 connected by ${userEmail}`);

    return {
        success: true,
        email: userEmail,
        message: "Google Search Console and Analytics connected successfully",
    };
});

// ── 3. Check Connection Status ──────────────────────────────────────────────

export const getGscConnectionStatus = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 10,
}, async () => {
    const doc = await db.doc(TOKEN_DOC_PATH).get();

    if (!doc.exists) {
        return { connected: false };
    }

    const data = doc.data()!;
    return {
        connected: true,
        email: data.connectedEmail || "unknown",
        siteUrl: data.siteUrl || "https://xiri.ai/",
        connectedAt: data.connectedAt?.toDate?.()?.toISOString() || null,
    };
});

// ── 4. Disconnect (revoke tokens) ───────────────────────────────────────────

export const disconnectGsc = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 15,
}, async () => {
    const doc = await db.doc(TOKEN_DOC_PATH).get();

    if (doc.exists) {
        const data = doc.data()!;

        // Attempt to revoke the access token at Google's end
        if (data.accessToken) {
            try {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${data.accessToken}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });
            } catch (err) {
                console.warn("[pSEO] Token revocation failed (non-critical):", err);
            }
        }

        // Delete the credentials doc
        await db.doc(TOKEN_DOC_PATH).delete();
    }

    return { success: true, message: "GSC disconnected" };
});

// ── Helper: Refresh Access Token ────────────────────────────────────────────

export async function getValidAccessToken(): Promise<string> {
    const doc = await db.doc(TOKEN_DOC_PATH).get();

    if (!doc.exists) {
        throw new Error("GSC not connected. Please connect in the SEO Engine settings.");
    }

    const data = doc.data()!;
    const now = Date.now();
    const expiry = data.tokenExpiry?.toMillis?.() || 0;

    // If token is still valid (with 5 min buffer), return it
    if (expiry > now + 5 * 60 * 1000) {
        return data.accessToken;
    }

    // Token expired — refresh it
    if (!data.refreshToken) {
        throw new Error("No refresh token available. Please reconnect GSC.");
    }

    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: gscClientId.value(),
            client_secret: gscClientSecret.value(),
            refresh_token: data.refreshToken,
            grant_type: "refresh_token",
        }),
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
        throw new Error(`Token refresh failed: ${refreshData.error_description || refreshData.error}`);
    }

    const newExpiry = admin.firestore.Timestamp.fromMillis(
        Date.now() + (refreshData.expires_in * 1000)
    );

    // Update the stored token
    await db.doc(TOKEN_DOC_PATH).update({
        accessToken: refreshData.access_token,
        tokenExpiry: newExpiry,
    });

    return refreshData.access_token;
}

// ── 5. Test GSC API Connection (fetch sample data) ──────────────────────────

export const testGscConnection = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
}, async () => {
    const accessToken = await getValidAccessToken();

    // Test GSC: list sites
    const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sitesData = await sitesResponse.json();

    // Test GSC: get sample performance data
    const siteUrl = "https://xiri.ai/";
    const today = new Date();
    const endDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago (data delay)
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before that

    const perfResponse = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                startDate: startDate.toISOString().split("T")[0],
                endDate: endDate.toISOString().split("T")[0],
                dimensions: ["page"],
                rowLimit: 5,
                dataState: "final",
            }),
        }
    );
    const perfData = await perfResponse.json();

    return {
        success: true,
        sites: sitesData.siteEntry?.map((s: any) => s.siteUrl) || [],
        samplePerformance: perfData.rows?.slice(0, 5) || [],
        dateRange: {
            start: startDate.toISOString().split("T")[0],
            end: endDate.toISOString().split("T")[0],
        },
    };
});
