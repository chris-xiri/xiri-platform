/**
 * ─── pSEO Deployment Pipeline ─────────────────────────────────────────────────
 *
 * Dual deployment for approved nudges:
 *   1. GitHub PR — creates a branch, applies changes to seo-data.json, opens PR
 *   2. Google Chat — posts a summary card when a batch deploy is triggered
 *
 * Triggered manually from dashboard "Deploy Batch" button or per-nudge.
 * Pattern: Same as other onCall functions (CORS, auth-optional single-tenant).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { sendText } from "../utils/googleChatUtils";
import type { PseoNudge, NudgeScope } from "@xiri/shared";
import { SCOPE_LABELS } from "@xiri/shared";

// Google Chat webhook — same secret as googleChatUtils, referenced separately for Cloud Function secrets[] binding
const googleChatWebhookSecret = defineSecret("GOOGLE_CHAT_WEBHOOK_URL");

// ── Config ───────────────────────────────────────────────────────────────────

const GITHUB_OWNER = "chris-xiri";
const GITHUB_REPO = "xiri-platform";
const GITHUB_DEFAULT_BRANCH = "main";
const SEO_DATA_PATH = "apps/public-site/data/seo-data.json";

const githubTokenSecret = defineSecret("GITHUB_PAT");

function getGithubToken(): string {
    return githubTokenSecret.value() || process.env.GITHUB_PAT || "";
}

// ── GitHub API Helpers ───────────────────────────────────────────────────────

interface GitHubApiOptions {
    method: string;
    path: string;
    body?: any;
    token: string;
}

async function githubApi({ method, path, body, token }: GitHubApiOptions): Promise<any> {
    const url = `https://api.github.com${path}`;
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${text}`);
    }

    // 204 No Content
    if (response.status === 204) return null;
    return response.json();
}

/** Get the SHA of the default branch HEAD */
async function getDefaultBranchSha(token: string): Promise<string> {
    const ref = await githubApi({
        method: "GET",
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}`,
        token,
    });
    return ref.object.sha;
}

/** Create a new branch from the default branch */
async function createBranch(branchName: string, sha: string, token: string): Promise<void> {
    await githubApi({
        method: "POST",
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
        body: { ref: `refs/heads/${branchName}`, sha },
        token,
    });
}

/** Get the current content + SHA of a file in the repo */
async function getFileContent(path: string, branch: string, token: string): Promise<{ content: string; sha: string }> {
    const file = await githubApi({
        method: "GET",
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${branch}`,
        token,
    });
    const content = Buffer.from(file.content, "base64").toString("utf-8");
    return { content, sha: file.sha };
}

/** Update a file on a branch */
async function updateFile(
    path: string,
    branch: string,
    content: string,
    sha: string,
    message: string,
    token: string,
): Promise<void> {
    await githubApi({
        method: "PUT",
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
        body: {
            message,
            content: Buffer.from(content, "utf-8").toString("base64"),
            sha,
            branch,
        },
        token,
    });
}

/** Create a pull request */
async function createPR(
    title: string,
    body: string,
    head: string,
    base: string,
    token: string,
): Promise<{ url: string; number: number }> {
    const pr = await githubApi({
        method: "POST",
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
        body: { title, body, head, base },
        token,
    });
    return { url: pr.html_url, number: pr.number };
}

// ── SEO Data Modification ────────────────────────────────────────────────────

/**
 * Apply approved nudges to the seo-data.json content.
 * Returns the modified JSON string, or null if no changes were made.
 *
 * This function modifies industry (template-level) and location (instance-level)
 * fields based on the nudge's targetSlug and targetField.
 */
function applySeoDataChanges(
    seoDataRaw: string,
    nudges: PseoNudge[],
): { modified: string; applied: string[]; skipped: string[] } {
    const seoData = JSON.parse(seoDataRaw);
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const nudge of nudges) {
        const value = nudge.editedValue || nudge.suggestedValue;
        const field = nudge.targetField;
        const slug = nudge.targetSlug;

        // Skip expansion nudges (these create new pages, not modify existing)
        if (nudge.scope === "expansion") {
            skipped.push(`${nudge.id}: expansion nudge (manual page creation)`);
            continue;
        }

        let found = false;

        // Try to find in industries (template-level)
        if (seoData.industries) {
            for (const industry of seoData.industries) {
                if (industry.slug === slug || slug.includes(industry.slug)) {
                    // Direct field mapping
                    if (field in industry) {
                        industry[field] = value;
                        found = true;
                    } else if (field === "metaTitle") {
                        industry.heroTitle = value; // Map metaTitle → heroTitle 
                        found = true;
                    } else if (field === "metaDescription") {
                        industry.heroSubtitle = value; // Map metaDescription → heroSubtitle
                        found = true;
                    }
                    if (found) break;
                }
            }
        }

        // Try to find in locations (instance-level)
        if (!found && seoData.locations) {
            for (const location of seoData.locations) {
                // Match by slug — instance pages have location slugs like "great-neck-ny"
                if (slug.includes(location.slug) || location.slug === slug) {
                    if (field in location) {
                        location[field] = value;
                        found = true;
                    } else if (field === "shortDescription") {
                        location.localInsight = value; // Map to most relevant
                        found = true;
                    } else if (field === "ctaText") {
                        location.whyXiri = value;
                        found = true;
                    } else if (field === "trustBadge" || field === "proofStatement") {
                        // Add/update trust signal in the location
                        location.trustStatement = value;
                        found = true;
                    } else if (field === "lastVerified") {
                        location.lastVerified = value;
                        found = true;
                    }
                    if (found) break;
                }
            }
        }

        if (found) {
            applied.push(nudge.id);
        } else {
            skipped.push(`${nudge.id}: could not locate ${slug}.${field} in seo-data.json`);
        }
    }

    return {
        modified: JSON.stringify(seoData, null, 2),
        applied,
        skipped,
    };
}

// ── PR Body Generation ───────────────────────────────────────────────────────

function buildPrBody(nudges: PseoNudge[], applied: string[], skipped: string[]): string {
    const lines: string[] = [
        "## 🔍 pSEO Content Optimizations",
        "",
        `This PR was auto-generated by the **XIRI pSEO Engine** based on approved optimization nudges.`,
        "",
        `**Applied:** ${applied.length} changes  |  **Skipped:** ${skipped.length}`,
        "",
        "---",
        "",
        "### Changes",
        "",
        "| Slug | Field | Rule | Priority | Change |",
        "|------|-------|------|----------|--------|",
    ];

    for (const nudge of nudges) {
        if (!applied.includes(nudge.id)) continue;
        const value = nudge.editedValue || nudge.suggestedValue;
        const truncatedValue = value.length > 80 ? value.slice(0, 77) + "..." : value;
        const truncatedCurrent = nudge.currentValue
            ? (nudge.currentValue.length > 60 ? nudge.currentValue.slice(0, 57) + "..." : nudge.currentValue)
            : "_empty_";
        lines.push(
            `| \`${nudge.targetSlug}\` | \`${nudge.targetField}\` | ${nudge.ruleTriggered} | ${nudge.priority} | ${truncatedCurrent} → **${truncatedValue}** |`
        );
    }

    if (skipped.length > 0) {
        lines.push("", "### Skipped", "");
        for (const s of skipped) {
            lines.push(`- ${s}`);
        }
    }

    lines.push(
        "",
        "---",
        "",
        "> ⚡ Auto-generated by XIRI pSEO Engine. Review changes in `seo-data.json` before merging.",
    );

    return lines.join("\n");
}

// ── Google Chat Notification ─────────────────────────────────────────────────

async function notifyDeployment(params: {
    batchId: string;
    segment: string;
    appliedCount: number;
    skippedCount: number;
    prUrl: string;
    prNumber: number;
}): Promise<void> {
    const threadKey = `pseo_deploy_${params.batchId}`;

    const summary = [
        `🚀 *pSEO Deploy: ${params.batchId}*`,
        `Segment: ${params.segment}`,
        `Changes applied: ${params.appliedCount}`,
        `Changes skipped: ${params.skippedCount}`,
        `PR: ${params.prUrl}`,
        "",
        `Review and merge PR #${params.prNumber} to push changes live.`,
    ].join("\n");

    await sendText(threadKey, summary);
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Deploy approved nudges from a batch to GitHub via PR.
 *
 * Called from dashboard "Deploy Batch" button.
 * Input: { batchId: string }
 *
 * Flow:
 *   1. Fetch all approved nudges for the batch
 *   2. Get seo-data.json from GitHub
 *   3. Apply changes
 *   4. Create branch + commit + PR
 *   5. Update nudge docs with PR URL
 *   6. Send Google Chat notification
 */
export const deployApprovedNudges = onCall({
    cors: DASHBOARD_CORS,
    secrets: [githubTokenSecret, googleChatWebhookSecret],
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (request) => {
    const { batchId } = request.data || {};

    if (!batchId || typeof batchId !== "string") {
        throw new HttpsError("invalid-argument", "batchId is required.");
    }

    const token = getGithubToken();
    if (!token) {
        throw new HttpsError("failed-precondition", "GITHUB_PAT secret not configured. Set it in Firebase Secrets.");
    }

    logger.info(`[pSEO Deploy] Starting deployment for batch "${batchId}"`);

    // 1. Fetch approved nudges for this batch
    const nudgesSnap = await db.collection("pseo_nudges")
        .where("batchId", "==", batchId)
        .where("status", "==", "approved")
        .get();

    if (nudgesSnap.empty) {
        throw new HttpsError("not-found", `No approved nudges found for batch "${batchId}".`);
    }

    const nudges: PseoNudge[] = nudgesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
    })) as PseoNudge[];

    logger.info(`[pSEO Deploy] Found ${nudges.length} approved nudges for batch "${batchId}"`);

    // 2. Create branch from main
    const branchName = `pseo/${batchId}`;
    const mainSha = await getDefaultBranchSha(token);
    
    try {
        await createBranch(branchName, mainSha, token);
    } catch (err: any) {
        // Branch may already exist if re-deploying
        if (err.message?.includes("422") && err.message?.includes("Reference already exists")) {
            logger.warn(`[pSEO Deploy] Branch "${branchName}" already exists, proceeding with update`);
        } else {
            throw err;
        }
    }

    logger.info(`[pSEO Deploy] Branch "${branchName}" created from ${mainSha.slice(0, 7)}`);

    // 3. Get current seo-data.json
    const { content: seoDataRaw, sha: fileSha } = await getFileContent(SEO_DATA_PATH, branchName, token);

    // 4. Apply nudge changes
    const { modified, applied, skipped } = applySeoDataChanges(seoDataRaw, nudges);

    if (applied.length === 0) {
        throw new HttpsError("not-found", "No changes could be applied to seo-data.json. All nudges were skipped.");
    }

    // 5. Commit the changes
    const commitMessage = `[pSEO] ${batchId}: ${applied.length} content optimizations\n\nApplied ${applied.length} approved nudges.\nSkipped ${skipped.length} nudges.`;
    await updateFile(SEO_DATA_PATH, branchName, modified, fileSha, commitMessage, token);

    logger.info(`[pSEO Deploy] Committed ${applied.length} changes to ${branchName}`);

    // 6. Create PR
    const segment = nudges[0]?.segment || "leads";
    const scopeBreakdown = nudges.reduce<Record<string, number>>((acc, n) => {
        const label = SCOPE_LABELS[n.scope as NudgeScope] || n.scope;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {});
    const scopeSummary = Object.entries(scopeBreakdown)
        .map(([label, count]) => `${count} ${label}`)
        .join(", ");

    const prTitle = `[pSEO] ${batchId} — ${applied.length} content optimizations (${scopeSummary})`;
    const prBodyText = buildPrBody(nudges, applied, skipped);
    const pr = await createPR(prTitle, prBodyText, branchName, GITHUB_DEFAULT_BRANCH, token);

    logger.info(`[pSEO Deploy] PR #${pr.number} created: ${pr.url}`);

    // 7. Update nudge docs with PR URL + deployed timestamp
    const batch = db.batch();
    for (const nudgeId of applied) {
        const ref = db.collection("pseo_nudges").doc(nudgeId);
        batch.update(ref, {
            prUrl: pr.url,
            deployedAt: new Date(),
            status: "approved", // Keep approved (could add 'deployed' status later)
        });
    }
    await batch.commit();

    // 8. Update batch doc with deployment info
    await db.collection("pseo_batches").doc(batchId).update({
        lastDeployedAt: new Date(),
        prUrl: pr.url,
        prNumber: pr.number,
        deployedCount: applied.length,
    });

    // 9. Google Chat notification
    try {
        await notifyDeployment({
            batchId,
            segment,
            appliedCount: applied.length,
            skippedCount: skipped.length,
            prUrl: pr.url,
            prNumber: pr.number,
        });
    } catch (err: any) {
        logger.warn("[pSEO Deploy] Chat notification failed (non-critical):", err.message);
    }

    return {
        success: true,
        prUrl: pr.url,
        prNumber: pr.number,
        applied: applied.length,
        skipped: skipped.length,
        branchName,
    };
});

/**
 * Get deployment status for a batch — checks if PR exists and its merge status.
 */
export const getPseoDeployStatus = onCall({
    cors: DASHBOARD_CORS,
    secrets: [githubTokenSecret],
    timeoutSeconds: 15,
}, async (request) => {
    const { batchId } = request.data || {};

    if (!batchId) {
        throw new HttpsError("invalid-argument", "batchId is required.");
    }

    // Check Firestore for deployment info
    const batchDoc = await db.collection("pseo_batches").doc(batchId).get();
    if (!batchDoc.exists) {
        return { deployed: false };
    }

    const data = batchDoc.data()!;

    if (!data.prUrl) {
        return { deployed: false };
    }

    // Check PR status on GitHub
    const token = getGithubToken();
    let prMerged = false;

    if (token && data.prNumber) {
        try {
            const pr = await githubApi({
                method: "GET",
                path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${data.prNumber}`,
                token,
            });
            prMerged = pr.merged === true;
        } catch {
            // Non-critical — just report what we know from Firestore
        }
    }

    return {
        deployed: true,
        prUrl: data.prUrl,
        prNumber: data.prNumber,
        prMerged,
        deployedCount: data.deployedCount || 0,
        lastDeployedAt: data.lastDeployedAt?.toDate?.()?.toISOString() || null,
    };
});
