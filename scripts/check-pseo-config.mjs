import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const seoRulesPath = path.join(repoRoot, "apps/public-site/lib/seo-rules.ts");
const pseoConfigPath = path.join(repoRoot, "packages/functions/src/pseo/config.ts");
const seoDataPath = path.join(repoRoot, "apps/public-site/data/seo-data.json");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractStringArray(source, constName) {
  const regex = new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const;`);
  const match = source.match(regex);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,$/, ""))
    .filter((line) => /^["'].*["']$/.test(line))
    .map((line) => line.slice(1, -1));
}

function extractSetValues(source, key) {
  const regex = new RegExp(`${key}: new Set\\(\\[(.*?)\\]\\)`, "s");
  const match = source.match(regex);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function routeExists(route) {
  const base = path.join(repoRoot, "apps/public-site/app");
  const clean = route.replace(/^\/+/, "");
  if (!clean) return fs.existsSync(path.join(base, "page.tsx"));
  const pagePath = path.join(base, clean, "page.tsx");
  const routePath = path.join(base, clean, "route.ts");
  return fs.existsSync(pagePath) || fs.existsSync(routePath);
}

function main() {
  const seoRules = read(seoRulesPath);
  const pseoConfig = read(pseoConfigPath);
  const seoData = JSON.parse(read(seoDataPath));

  const staticRoutes = extractStringArray(seoRules, "SITEMAP_STATIC_ROUTES");
  const missingRoutes = staticRoutes.filter((route) => !routeExists(route));
  if (missingRoutes.length > 0) {
    throw new Error(`Sitemap static routes missing app routes: ${missingRoutes.join(", ")}`);
  }

  const industryFields = extractSetValues(pseoConfig, "industries");
  const serviceFields = extractSetValues(pseoConfig, "services");
  const locationFields = extractSetValues(pseoConfig, "locations");

  const industrySchema = new Set(Object.keys(seoData.industries?.[0] || {}));
  industrySchema.add("metaTitle");
  industrySchema.add("metaDescription");
  const serviceSchema = new Set(Object.keys(seoData.services?.[0] || {}));
  serviceSchema.add("metaTitle");
  serviceSchema.add("metaDescription");
  const locationSchema = new Set(Object.keys(seoData.locations?.[0] || {}));
  locationSchema.add("shortDescription");
  locationSchema.add("localContext");
  locationSchema.add("ctaText");
  locationSchema.add("metaTitle");
  locationSchema.add("metaDescription");
  locationSchema.add("trustBadge");
  locationSchema.add("proofStatement");

  const badIndustryFields = industryFields.filter((f) => !industrySchema.has(f));
  const badServiceFields = serviceFields.filter((f) => !serviceSchema.has(f));
  const badLocationFields = locationFields.filter((f) => !locationSchema.has(f));

  const errors = [];
  if (badIndustryFields.length) errors.push(`invalid industry deploy fields: ${badIndustryFields.join(", ")}`);
  if (badServiceFields.length) errors.push(`invalid service deploy fields: ${badServiceFields.join(", ")}`);
  if (badLocationFields.length) errors.push(`invalid location deploy fields: ${badLocationFields.join(", ")}`);

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  console.log("pSEO config checks passed");
}

main();
