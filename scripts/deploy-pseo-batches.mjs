/**
 * Programmatic pSEO batch deployer — runs the same logic as `deployApprovedNudges`
 * Cloud Function but locally via Firebase Admin + GitHub API, no auth required.
 *
 * Usage: node scripts/deploy-pseo-batches.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Config ────────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) { console.error('Set GITHUB_TOKEN env var'); process.exit(1); }
const GITHUB_OWNER = "chris-xiri";
const GITHUB_REPO = "xiri-platform";
const GITHUB_DEFAULT_BRANCH = "main";
const SEO_DATA_PATH = "apps/public-site/data/seo-data.json";

const BATCHES = ["2026-W15-leads", "2026-W16-leads"];

// ── Firebase Admin Init ───────────────────────────────────────────────────────

initializeApp({
  credential: cert("service-account.json"),
  projectId: "xiri-facility-solutions",
});
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// ── GitHub API ────────────────────────────────────────────────────────────────

async function githubApi({ method, path, body }) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(`GitHub ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function getDefaultBranchSha() {
  const ref = await githubApi({ method: "GET", path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}` });
  return ref.object.sha;
}

async function createBranch(branchName, sha) {
  await githubApi({ method: "POST", path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, body: { ref: `refs/heads/${branchName}`, sha } });
}

async function getFileContent(path, branch) {
  const file = await githubApi({ method: "GET", path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${branch}` });
  const content = Buffer.from(file.content, "base64").toString("utf-8");
  return { content, sha: file.sha };
}

async function updateFile(path, branch, content, sha, message) {
  await githubApi({ method: "PUT", path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, body: { message, content: Buffer.from(content, "utf-8").toString("base64"), sha, branch } });
}

async function createPR(title, body, head, base) {
  const pr = await githubApi({ method: "POST", path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, body: { title, body, head, base } });
  return { url: pr.html_url, number: pr.number };
}

// ── SEO Data Modifier ─────────────────────────────────────────────────────────

/**
 * Finds a matching location entry from seoData by scanning the nudge slug.
 * Instead of regex-parsing the nudge's slug format, we check if the nudge slug
 * contains any known location slug as a substring.
 *
 * e.g. "services/commercial-cleaning-in-old-bethpage-nassau-county-ny"  → matches "old-bethpage-ny"
 * e.g. "solutions/dental-suite-sanitization-in-jericho-ny"              → matches "jericho-ny"
 * e.g. "services/floor-care-in-manhasset-nassau-county-ny"              → matches "manhasset-ny"
 * e.g. "contractors/janitorial-subcontractor-in-port-washington-ny"     → matches "port-washington-ny"
 */
function findLocationMatch(nudgeSlug, locations) {
  // Try exact match first
  const exact = locations.find(l => l.slug === nudgeSlug);
  if (exact) return exact;
  // Scan all known location slugs — find the one whose slug appears in the nudge slug
  // Sort by length descending to prefer longer (more specific) matches
  const sorted = [...locations].sort((a, b) => b.slug.length - a.slug.length);
  return sorted.find(l => nudgeSlug.includes(l.slug)) ?? null;
}

function applySeoDataChanges(seoDataRaw, nudges) {
  const seoData = JSON.parse(seoDataRaw);
  const applied = [];
  const skipped = [];

  for (const nudge of nudges) {
    const value = nudge.editedValue || nudge.suggestedValue;
    const field = nudge.targetField;
    const slug = nudge.targetSlug;

    if (nudge.scope === "expansion") {
      skipped.push(`${nudge.id}: expansion nudge (manual page creation)`);
      continue;
    }

    let found = false;

    // Template-level: match services
    if (!found && seoData.services) {
      for (const service of seoData.services) {
        if (service.slug === slug || slug.includes(service.slug)) {
          if (field in service) { service[field] = value; found = true; }
          else if (field === "metaTitle") { service.heroTitle = value; found = true; }
          else if (field === "metaDescription") { service.heroSubtitle = value; found = true; }
          if (found) break;
        }
      }
    }

    // Template-level: match industries
    if (!found && seoData.industries) {
      for (const industry of seoData.industries) {
        if (industry.slug === slug || slug.includes(industry.slug)) {
          if (field in industry) { industry[field] = value; found = true; }
          else if (field === "metaTitle") { industry.heroTitle = value; found = true; }
          else if (field === "metaDescription") { industry.heroSubtitle = value; found = true; }
          if (found) break;
        }
      }
    }

    // Instance-level: match locations by scanning known slugs
    if (!found && seoData.locations) {
      const location = findLocationMatch(slug, seoData.locations);
      if (location) {
        if (field in location) { location[field] = value; found = true; }
        else if (field === "shortDescription") { location.localInsight = value; found = true; }
        else if (field === "metaTitle") { location.pageTitle = value; found = true; }
        else if (field === "metaDescription") { location.metaDescription = value; found = true; }
        else if (field === "ctaText") { location.whyXiri = value; found = true; }
        else if (field === "trustBadge" || field === "proofStatement") { location.trustStatement = value; found = true; }
        else if (field === "lastVerified") { location.lastVerified = value; found = true; }
      }
    }

    if (found) applied.push(nudge.id);
    else skipped.push(`${nudge.id}: no match for slug="${slug}" field="${field}"`);
  }

  return { modified: JSON.stringify(seoData, null, 2), applied, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function deployBatch(batchId) {
  console.log(`\n🚀 Deploying batch: ${batchId}`);

  // 1. Fetch approved nudges
  const snap = await db.collection("pseo_nudges")
    .where("batchId", "==", batchId)
    .where("status", "==", "approved")
    .get();

  if (snap.empty) {
    console.warn(`   ⚠️  No approved nudges found for ${batchId}`);
    return;
  }
  const nudges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`   Found ${nudges.length} approved nudges`);

  // 2. Create branch
  const branchName = `pseo/${batchId}`;
  const mainSha = await getDefaultBranchSha();
  try {
    await createBranch(branchName, mainSha);
    console.log(`   Branch: ${branchName} (created from ${mainSha.slice(0, 7)})`);
  } catch (err) {
    if (err.message?.includes("422") && err.message?.includes("Reference already exists")) {
      console.warn(`   ⚠️  Branch already exists — will update`);
    } else {
      throw err;
    }
  }

  // 3. Get seo-data.json — read main content (to build on latest), but use branch SHA for the PUT
  const { content: seoDataRaw } = await getFileContent(SEO_DATA_PATH, GITHUB_DEFAULT_BRANCH);
  const { sha: fileSha } = await getFileContent(SEO_DATA_PATH, branchName);

  // 4. Apply changes
  const { modified, applied, skipped } = applySeoDataChanges(seoDataRaw, nudges);
  console.log(`   Applied: ${applied.length} | Skipped: ${skipped.length}`);

  if (applied.length === 0) {
    console.error(`   ❌ No changes could be applied — all nudges skipped`);
    if (skipped.length > 0) skipped.forEach(s => console.log(`      - ${s}`));
    return;
  }

  // 5. Commit
  const commitMsg = `[pSEO] ${batchId}: ${applied.length} content optimizations\n\nApplied ${applied.length} approved nudges.\nSkipped ${skipped.length} nudges.`;
  await updateFile(SEO_DATA_PATH, branchName, modified, fileSha, commitMsg);
  console.log(`   Committed to ${branchName}`);

  // 6. Create PR
  const pr = await createPR(
    `[pSEO] ${batchId} — ${applied.length} content optimizations`,
    `## 🔍 pSEO Content Optimizations\n\nAuto-generated by XIRI pSEO Engine.\n\n**Applied:** ${applied.length}  |  **Skipped:** ${skipped.length}\n\n> Review changes in \`seo-data.json\` before merging.`,
    branchName,
    GITHUB_DEFAULT_BRANCH,
  );
  console.log(`   PR #${pr.number}: ${pr.url}`);

  // 7. Update Firestore — nudges + batch doc
  const batch = db.batch();
  for (const nudgeId of applied) {
    batch.update(db.collection("pseo_nudges").doc(nudgeId), { prUrl: pr.url, deployedAt: new Date() });
  }
  await batch.commit();

  await db.collection("pseo_batches").doc(batchId).update({
    lastDeployedAt: new Date(),
    prUrl: pr.url,
    prNumber: pr.number,
    deployedCount: applied.length,
  });

  console.log(`   ✅ Firestore updated`);
}

async function main() {
  for (const batchId of BATCHES) {
    try {
      await deployBatch(batchId);
    } catch (err) {
      console.error(`   ❌ [${batchId}] Error:`, err.message);
    }
  }
  console.log("\n✅ Done. Check GitHub for PRs.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
