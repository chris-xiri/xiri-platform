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
import {
    normalizeTargetSlug,
    PSEO_DEPLOYABLE_FIELDS,
    type PseoSkipReason,
} from "../pseo/config";

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
 * Finds a matching location entry by scanning known location slugs against the nudge slug.
 * Instead of regex-parsing the nudge slug format, we check if the nudge slug
 * contains any known location slug as a substring.
 *
 * e.g. "services/commercial-cleaning-in-old-bethpage-nassau-county-ny" → matches "old-bethpage-ny"
 * e.g. "services/floor-care-in-manhasset-nassau-county-ny"             → matches "manhasset-ny"
 * e.g. "solutions/dental-suite-sanitization-in-jericho-ny"             → matches "jericho-ny"
 * e.g. "contractors/janitorial-subcontractor-in-port-washington-ny"    → matches "port-washington-ny"
 */
function findLocationMatch<T extends { slug: string }>(nudgeSlug: string, locations: T[]): T | null {
    const normalized = normalizeTargetSlug(nudgeSlug);
    // Try exact match first
    const exact = locations.find(l => l.slug === normalized);
    if (exact) return exact;
    // Scan all known location slugs — prefer longer (more specific) matches to avoid false positives
    const sorted = [...locations].sort((a, b) => b.slug.length - a.slug.length);
    return sorted.find(l => normalized.includes(l.slug)) ?? null;
}

type RouteFamily = "services" | "industries" | "locations" | "unknown";

function getRouteFamily(slug: string): RouteFamily {
    const normalized = normalizeTargetSlug(slug);
    if (normalized.startsWith("services/")) return "services";
    if (normalized.startsWith("industries/")) return "industries";
    if (normalized.startsWith("contractors/")) return "locations";
    if (normalized.includes("-in-")) return "locations";
    return "unknown";
}

function getEntitySlug(slug: string, family: RouteFamily): string | null {
    const normalized = normalizeTargetSlug(slug);
    const segments = normalized.split("/").filter(Boolean);
    if (family === "services") {
        const value = segments[1] || "";
        return value ? value.split("-in-")[0] : null;
    }
    if (family === "industries") {
        const value = segments.length >= 3 ? segments[2] : segments[1];
        return value ? value.split("-in-")[0] : null;
    }
    return null;
}

/**
 * Apply approved nudges to the seo-data.json content.
 * Returns the modified JSON string, or null if no changes were made.
 *
 * This function modifies service/industry (template-level) and location (instance-level)
 * fields based on the nudge's targetSlug and targetField.
 */
function applySeoDataChanges(
    seoDataRaw: string,
    nudges: PseoNudge[],
): {
    modified: string;
    applied: string[];
    skipped: string[];
    skippedByReason: PseoSkipReason[];
    unsupportedFields: string[];
    expansionQueue: Array<{ nudgeId: string; targetSlug: string; reasoning: string }>;
} {
    const seoData = JSON.parse(seoDataRaw);
    const applied: string[] = [];
    const skipped: string[] = [];
    const skippedByReason: PseoSkipReason[] = [];
    const unsupportedFields = new Set<string>();
    const expansionQueue: Array<{ nudgeId: string; targetSlug: string; reasoning: string }> = [];

    const pushSkip = (nudge: PseoNudge, code: PseoSkipReason["code"], message: string) => {
        skipped.push(`${nudge.id}: ${message}`);
        skippedByReason.push({
            nudgeId: nudge.id,
            code,
            message,
            targetSlug: nudge.targetSlug,
            targetField: nudge.targetField,
        });
        if (code === "unsupported_field") {
            unsupportedFields.add(nudge.targetField);
        }
    };

    for (const nudge of nudges) {
        const value = nudge.editedValue || nudge.suggestedValue;
        const field = nudge.targetField;
        const slug = normalizeTargetSlug(nudge.targetSlug);
        const family = getRouteFamily(slug);

        // Skip expansion nudges (these create new pages, not modify existing)
        if (nudge.scope === "expansion") {
            expansionQueue.push({
                nudgeId: nudge.id,
                targetSlug: slug,
                reasoning: nudge.reasoning,
            });
            pushSkip(nudge, "expansion_queued", "expansion nudge queued for manual page creation");
            continue;
        }

        if (!value || !String(value).trim()) {
            pushSkip(nudge, "empty_value", "empty suggested value");
            continue;
        }

        if (family === "unknown") {
            pushSkip(nudge, "target_not_found", `unsupported target route "${slug}"`);
            continue;
        }

        let found = false;

        // Try to find in industries (template-level)
        if ((family === "industries" || family === "locations") && seoData.industries) {
            const industrySlug = getEntitySlug(slug, "industries");
            for (const industry of seoData.industries) {
                if (industrySlug && (industry.slug === industrySlug || slug.includes(industry.slug))) {
                    if (!PSEO_DEPLOYABLE_FIELDS.industries.has(field as any)) {
                        pushSkip(nudge, "unsupported_field", `unsupported field "${field}" for industries`);
                        found = true;
                        break;
                    }
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

        // Template-level services support (required for lead pSEO reliability)
        if (!found && (family === "services" || family === "locations") && seoData.services) {
            const serviceSlug = getEntitySlug(slug, "services");
            for (const service of seoData.services) {
                if (serviceSlug && (service.slug === serviceSlug || slug.includes(service.slug))) {
                    if (!PSEO_DEPLOYABLE_FIELDS.services.has(field as any)) {
                        pushSkip(nudge, "unsupported_field", `unsupported field "${field}" for services`);
                        found = true;
                        break;
                    }
                    if (field in service) {
                        service[field] = value;
                        found = true;
                    } else if (field === "metaTitle") {
                        service.heroTitle = value;
                        found = true;
                    } else if (field === "metaDescription") {
                        service.heroSubtitle = value;
                        found = true;
                    }
                    if (found) break;
                }
            }
        }

        // Instance-level: match locations by scanning known slugs
        if (!found && seoData.locations) {
            const location = findLocationMatch(slug, seoData.locations);
            if (location) {
                if (!PSEO_DEPLOYABLE_FIELDS.locations.has(field as any)) {
                    pushSkip(nudge, "unsupported_field", `unsupported field "${field}" for locations`);
                    found = true;
                    continue;
                }
                if (field in location) {
                    location[field] = value;
                    found = true;
                } else if (field === "shortDescription") {
                    location.localInsight = value;
                    found = true;
                } else if (field === "metaTitle") {
                    location.pageTitle = value;
                    found = true;
                } else if (field === "metaDescription") {
                    location.metaDescription = value;
                    found = true;
                } else if (field === "ctaText") {
                    location.whyXiri = value;
                    found = true;
                } else if (field === "trustBadge") {
                    location.complianceNote = value;
                    found = true;
                } else if (field === "proofStatement") {
                    location.localInsight = value;
                    found = true;
                } else if (field === "lastVerified") {
                    location.lastVerified = value;
                    found = true;
                }
            }
        }

        if (found) {
            applied.push(nudge.id);
        } else {
            pushSkip(nudge, "target_not_found", `could not locate ${slug}.${field} in seo-data.json`);
        }
    }

    return {
        modified: JSON.stringify(seoData, null, 2),
        applied,
        skipped,
        skippedByReason,
        unsupportedFields: Array.from(unsupportedFields),
        expansionQueue,
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
    const { batchId, force } = request.data || {};

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
    const {
        modified,
        applied,
        skipped,
        skippedByReason,
        unsupportedFields,
        expansionQueue,
    } = applySeoDataChanges(seoDataRaw, nudges);

    if (skipped.length !== skippedByReason.length) {
        throw new HttpsError("internal", "Deploy aborted: skipped nudges must include explicit reason codes.");
    }

    if (applied.length === 0) {
        if (!force) {
            throw new HttpsError(
                "failed-precondition",
                "Deploy aborted: zero applicable nudges in batch. Re-run with force=true if this is expected.",
            );
        }
        await db.collection("pseo_batches").doc(batchId).set({
            lastDeployAttemptAt: new Date(),
            deployedCount: 0,
            skippedCount: skipped.length,
            deploySkippedByReason: skippedByReason,
            unsupportedFields,
            expansionQueueCount: expansionQueue.length,
            reliability: {
                generated: nudges.length,
                deduped: 0,
                applied: 0,
                skipped_by_reason: skippedByReason.reduce<Record<string, number>>((acc, s) => {
                    acc[s.code] = (acc[s.code] || 0) + 1;
                    return acc;
                }, {}),
                unsupported_fields: unsupportedFields.length,
                missing_metrics: {},
            },
        }, { merge: true });

        return {
            success: false,
            forced: true,
            message: "No deployable nudges were applied. Batch recorded with skip reasons.",
            applied: 0,
            skipped: skipped.length,
            skippedByReason,
            unsupportedFields,
            expansionQueueCount: expansionQueue.length,
        };
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

    // 7b. Persist explicit skip reasons on nudges not applied in this deploy
    if (skippedByReason.length > 0) {
        const skipBatch = db.batch();
        for (const skip of skippedByReason) {
            const ref = db.collection("pseo_nudges").doc(skip.nudgeId);
            skipBatch.set(ref, {
                deploySkippedAt: new Date(),
                deploySkipReason: skip,
            }, { merge: true });
        }
        await skipBatch.commit();
    }

    // 8. Update batch doc with deployment info
    await db.collection("pseo_batches").doc(batchId).update({
        lastDeployedAt: new Date(),
        prUrl: pr.url,
        prNumber: pr.number,
        deployedCount: applied.length,
        skippedCount: skipped.length,
        deploySkippedByReason: skippedByReason,
        unsupportedFields,
        expansionQueueCount: expansionQueue.length,
        reliability: {
            generated: nudges.length,
            deduped: 0,
            applied: applied.length,
            skipped_by_reason: skippedByReason.reduce<Record<string, number>>((acc, s) => {
                acc[s.code] = (acc[s.code] || 0) + 1;
                return acc;
            }, {}),
            unsupported_fields: unsupportedFields.length,
            missing_metrics: {},
        },
    });

    // 8b. Persist explicit expansion queue artifact (non-destructive)
    if (expansionQueue.length > 0) {
        await db.collection("pseo_expansion_queue").doc(batchId).set({
            batchId,
            createdAt: new Date(),
            segment,
            count: expansionQueue.length,
            items: expansionQueue,
        }, { merge: true });
    }

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
        skippedByReason,
        unsupportedFields,
        expansionQueueCount: expansionQueue.length,
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
