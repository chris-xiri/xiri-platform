/**
 * Re-enrich and strictly validate existing `prospect_queue` records using
 * website-only scraping (0 Serper credits, ZERO email guessing) + live DNS MX checks.
 *
 * - Removes non-ICP hospital/DSO records
 * - Replaces bogus LinkedIn/pattern_guess contacts with real Office/Practice Managers
 *   scraped directly from each practice's own website (/meet-the-team, /staff, /contact)
 * - Keeps ONLY real emails actually published on the practice's own website that pass
 *   live DNS MX validation; removes practices with no verifiable website email.
 *
 * Usage:
 *   npx tsx --tsconfig packages/functions/tsconfig.json scripts/reenrich-website-only.ts
 */

import * as fs from 'fs';
import * as dns from 'dns';
import * as admin from 'firebase-admin';
import { scrapeWebsite, deepMailtoScan } from '../packages/functions/src/utils/websiteScraper';
import { isKnownDsoChain } from '../packages/functions/src/utils/facilityClassifier';
import { isOrthodonticPractice, cleanBusinessName } from '../packages/shared/src/index';

function buildDeterministicDraft(params: {
    businessName: string;
    contactName?: string | null;
    contactTitle?: string | null;
    location?: string | null;
    isOrtho: boolean;
    keyObservation?: string | null;
}) {
    const cleanName = cleanBusinessName(params.businessName);
    const firstName = params.contactName?.trim().split(/\s+/)[0] || '';
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    const resource = 'CDC/OSHA dental & orthodontic terminal cleaning checklist';
    const guideUrl = 'https://xiri.ai/guides/dental-office-terminal-cleaning-checklist';
    const subject = `${cleanName} — quick dental & ortho terminal cleaning checklist`;
    const body = `${greeting}\n\nWe put together a 1-page ${resource} built specifically for private Metro NY practices like ${cleanName}${params.location ? ` (${params.location.split(',')[0]})` : ''}.\n\nYou can view or share it with your team here:\n${guideUrl}\n\nIf you ever want a second pair of eyes on your current evening cleaning scope or a no-pressure walkthrough quote, just reply to this email.\n\nBest,\nChris Leung\nXIRI Facility Solutions\nhttps://xiri.ai`;
    return { subject, body };
}

const saPath = 'k:/Repos/xiri-platform/service-account.json';
if (!admin.apps.length) {
    admin.initializeApp({
        credential: fs.existsSync(saPath)
            ? admin.credential.cert(require(saPath))
            : admin.credential.applicationDefault(),
        projectId: 'xiri-facility-solutions',
    });
}
const db = admin.firestore();

const GENERIC_PREFIXES = /^(info|contact|hello|office|admin|sales|team|service|services|marketing|support|billing|accounting|inquiries|frontdesk|appointments|scheduling|reception)@/i;
const HOSPITAL_OR_INSTITUTION = /\b(hospital|health\s*center|medical\s*center|tbh\.org|northwell|nyu\s*langone|mount\s*sinai|montefiore|maimonides|brooklyn\s*hospital|university|college\s*of\s*dentistry)\b/i;
const FREE_PROVIDERS = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'me.com', 'live.com', 'msn.com', 'verizon.net', 'optonline.net']);

function getDomain(url?: string | null): string | null {
    if (!url) return null;
    try {
        return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

async function verifyMx(email: string): Promise<boolean> {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain || !domain.includes('.')) return false;
    try {
        const recs = await Promise.race([
            dns.promises.resolveMx(domain),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500)),
        ]);
        return Array.isArray(recs) && recs.length > 0;
    } catch {
        return false;
    }
}

async function main() {
    const pqSnap = await db.collection('prospect_queue').get();
    console.log(`\n🔍 Auditing & re-enriching ${pqSnap.size} prospects (website-only, 0 Serper credits, DNS MX validated)...\n`);

    const summary: Array<{
        businessName: string;
        action: string;
        oldEmail: string | null;
        oldSource: string | null;
        newEmail: string | null;
        newContact: string | null;
        newTitle: string | null;
        mxValid?: boolean;
    }> = [];

    for (const doc of pqSnap.docs) {
        const d = doc.data();
        const biz = d.businessName || doc.id;
        const website: string | null = d.website || null;
        const oldEmail = d.contactEmail || d.genericEmail || null;
        const oldSource = d.emailSource || null;

        // 1. Disqualify hospitals / DSOs
        if (isKnownDsoChain(biz, website) || HOSPITAL_OR_INSTITUTION.test(`${biz} ${website || ''}`)) {
            await doc.ref.delete();
            if (d.companyId) {
                await db.collection('companies').doc(d.companyId).delete().catch(() => {});
                if (d.contactId) await db.collection('contacts').doc(d.contactId).delete().catch(() => {});
            }
            summary.push({ businessName: biz, action: 'REMOVED (DSO/Hospital)', oldEmail, oldSource, newEmail: null, newContact: null, newTitle: null });
            continue;
        }

        if (!website) {
            await doc.ref.delete();
            summary.push({ businessName: biz, action: 'REMOVED (No website)', oldEmail, oldSource, newEmail: null, newContact: null, newTitle: null });
            continue;
        }

        const siteDomain = getDomain(website);
        let scrapedEmail: string | null = null;
        let scrapedConfidence: 'high' | 'medium' = 'high';
        let scrapedSource: 'mailto' | 'structured_data' | 'regex' = 'mailto';
        let contactName: string | null = null;
        let contactTitle: string | null = null;
        let allValidEmails: Array<{ email: string; type: 'personal' | 'generic' }> = [];

        try {
            const res = await scrapeWebsite(website, '', {
                businessName: biz,
                address: d.address || d.searchLocation,
                website,
            });

            if (res.success && res.data) {
                contactName = res.data.ownerName || null;
                contactTitle = res.data.ownerTitle || null;

                const candidates = [
                    ...(res.data.ownerEmail ? [{ email: res.data.ownerEmail, src: 'mailto' as const }] : []),
                    ...(res.data.email ? [{ email: res.data.email, src: (res.data.source === 'structured_data' ? 'structured_data' : 'mailto') as const }] : []),
                    ...((res.data.allEmails || []).map(e => ({ email: e.email, src: 'regex' as const }))),
                ];

                // Deduplicate & filter to site-domain or website-published free provider
                const seen = new Set<string>();
                const domainMatches: Array<{ email: string; isPersonal: boolean; src: 'mailto' | 'structured_data' | 'regex' }> = [];
                const freeMatches: Array<{ email: string; src: 'mailto' | 'structured_data' | 'regex' }> = [];

                for (const c of candidates) {
                    const em = c.email.trim().toLowerCase();
                    if (!em || seen.has(em) || !em.includes('@')) continue;
                    seen.add(em);
                    const emDomain = em.split('@')[1];
                    if (siteDomain && (emDomain === siteDomain || emDomain.endsWith(`.${siteDomain}`) || siteDomain.endsWith(`.${emDomain}`))) {
                        const isPersonal = !GENERIC_PREFIXES.test(em);
                        domainMatches.push({ email: em, isPersonal, src: c.src });
                        allValidEmails.push({ email: em, type: isPersonal ? 'personal' : 'generic' });
                    } else if (FREE_PROVIDERS.has(emDomain)) {
                        freeMatches.push({ email: em, src: c.src });
                        allValidEmails.push({ email: em, type: 'personal' });
                    }
                }

                // Prefer non-generic domain match, then domain generic, then website-published free provider
                const bestDomainPersonal = domainMatches.find(m => m.isPersonal);
                const bestDomainGeneric = domainMatches[0];
                if (bestDomainPersonal) {
                    scrapedEmail = bestDomainPersonal.email;
                    scrapedSource = bestDomainPersonal.src;
                    scrapedConfidence = 'high';
                } else if (bestDomainGeneric) {
                    scrapedEmail = bestDomainGeneric.email;
                    scrapedSource = bestDomainGeneric.src;
                    scrapedConfidence = 'high';
                } else if (freeMatches[0]) {
                    scrapedEmail = freeMatches[0].email;
                    scrapedSource = freeMatches[0].src;
                    scrapedConfidence = 'medium';
                }
            }

            // Fallback: deepMailtoScan on additional internal pages (0 Serper credits)
            if (!scrapedEmail) {
                const deep = await deepMailtoScan(website);
                if (deep.email) {
                    const em = deep.email.trim().toLowerCase();
                    const emDomain = em.split('@')[1];
                    if (siteDomain && (emDomain === siteDomain || emDomain.endsWith(`.${siteDomain}`))) {
                        scrapedEmail = em;
                        scrapedSource = 'mailto';
                        scrapedConfidence = 'high';
                    } else if (FREE_PROVIDERS.has(emDomain)) {
                        scrapedEmail = em;
                        scrapedSource = 'mailto';
                        scrapedConfidence = 'medium';
                    }
                }
            }
        } catch (err: any) {
            console.warn(`   ⚠️ Scrape failed for ${biz}: ${err?.message || err}`);
        }

        if (!scrapedEmail) {
            // No real email published on the practice's own website — remove bogus/guessed entry
            await doc.ref.delete();
            if (d.companyId) {
                await db.collection('companies').doc(d.companyId).delete().catch(() => {});
                if (d.contactId) await db.collection('contacts').doc(d.contactId).delete().catch(() => {});
                const oq = await db.collection('outreach_queue').where('leadId', '==', d.companyId).get();
                for (const t of oq.docs) await t.ref.delete();
            }
            summary.push({
                businessName: biz,
                action: 'REMOVED (No email on website)',
                oldEmail,
                oldSource,
                newEmail: null,
                newContact: contactName,
                newTitle: contactTitle,
            });
            continue;
        }

        const mxValid = await verifyMx(scrapedEmail);
        if (!mxValid) {
            await doc.ref.delete();
            summary.push({
                businessName: biz,
                action: 'REMOVED (MX invalid)',
                oldEmail,
                oldSource,
                newEmail: scrapedEmail,
                newContact: contactName,
                newTitle: contactTitle,
                mxValid: false,
            });
            continue;
        }

        const isOrtho = isOrthodonticPractice({
            clinicType: d.dossier?.clinicType || d.practiceSpecialty,
            businessName: biz,
            searchQuery: d.searchQuery,
        });
        const resolvedTitle = contactTitle || (isOrtho ? 'Office Manager' : 'Practice Manager');

        // Refresh personalized Touch 1 draft using the real website Office Manager name
        const draft = buildDeterministicDraft({
            businessName: biz,
            contactName,
            contactTitle: resolvedTitle,
            location: d.address || d.searchLocation,
            isOrtho,
            keyObservation: d.dossier?.keyObservation || null,
        });

        await doc.ref.update({
            contactName: contactName || null,
            contactTitle: contactTitle || null,
            inferredTitle: contactTitle ? null : resolvedTitle,
            contactEmail: scrapedEmail,
            genericEmail: GENERIC_PREFIXES.test(scrapedEmail) ? scrapedEmail : null,
            emailSource: scrapedSource,
            emailConfidence: scrapedConfidence,
            emailMxVerified: true,
            allContacts: allValidEmails.map(e => ({
                email: e.email,
                type: e.type,
                provider: 'website_scrape',
                confidence: scrapedConfidence === 'high' ? 95 : 80,
            })),
            outreachDraft: draft,
            practiceSpecialty: isOrtho ? 'ortho' : (d.practiceSpecialty || 'general'),
            updatedAt: new Date(),
        });

        // Also sync linked CRM company/contact/outreach_queue if already imported
        if (d.companyId) {
            await db.collection('companies').doc(d.companyId).set({
                email: scrapedEmail,
                contactName: contactName || resolvedTitle,
                contactTitle: resolvedTitle,
                outreachDraft: draft,
                updatedAt: new Date(),
            }, { merge: true });
        }
        if (d.contactId) {
            const parts = (contactName || '').trim().split(/\s+/).filter(Boolean);
            await db.collection('contacts').doc(d.contactId).set({
                email: scrapedEmail,
                name: contactName || resolvedTitle,
                firstName: parts[0] || '',
                lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
                title: resolvedTitle,
                emailSource: scrapedSource,
                emailConfidence: scrapedConfidence,
                updatedAt: new Date(),
            }, { merge: true });
        }

        if (d.companyId) {
            const oq = await db.collection('outreach_queue').where('leadId', '==', d.companyId).get();
            for (const t of oq.docs) {
                const td = t.data();
                if (td.status === 'PENDING') {
                    await t.ref.set({
                        metadata: {
                            ...(td.metadata || {}),
                            email: scrapedEmail,
                            contactEmail: scrapedEmail,
                            contactName: contactName || resolvedTitle,
                            contactTitle: resolvedTitle,
                            outreachDraft: draft,
                        },
                        updatedAt: new Date(),
                    }, { merge: true });
                }
            }
        }

        summary.push({
            businessName: biz,
            action: 'VERIFIED & UPDATED',
            oldEmail,
            oldSource,
            newEmail: scrapedEmail,
            newContact: contactName,
            newTitle: contactTitle,
            mxValid: true,
        });
    }

    const kept = summary.filter(s => s.action === 'VERIFIED & UPDATED');
    const removed = summary.filter(s => s.action !== 'VERIFIED & UPDATED');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  AUDIT COMPLETE: ${kept.length} verified website emails kept | ${removed.length} removed`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('VERIFIED & KEPT:');
    for (const s of kept) {
        console.log(`  ✅ ${s.businessName}`);
        console.log(`     Contact: ${s.newContact || '(Office/Practice Manager)'}${s.newTitle ? ` — ${s.newTitle}` : ''}`);
        console.log(`     Email:   ${s.newEmail} (MX verified ✓ | was: ${s.oldEmail} [${s.oldSource}])`);
    }
    console.log('\nREMOVED (Guessed / No website email / Non-ICP):');
    for (const s of removed) {
        console.log(`  🗑️  ${s.businessName} — ${s.action} (was: ${s.oldEmail} [${s.oldSource}])`);
    }

    // Verify CRM collections (companies, contacts, lead outreach_queue)
    const [coSnap, ctSnap, oqSnap] = await Promise.all([
        db.collection('companies').get(),
        db.collection('contacts').get(),
        db.collection('outreach_queue').get(),
    ]);
    const leadTasks = oqSnap.docs.filter(d => !d.data().vendorId);
    console.log(`\n📊 POST-AUDIT CRM STATE: companies=${coSnap.size}, contacts=${ctSnap.size}, lead_outreach_queue=${leadTasks.length}`);
    for (const c of coSnap.docs) {
        const cd = c.data();
        console.log(`   Company: ${cd.businessName || c.id} | email=${cd.email || 'none'} | contact=${cd.contactName || 'none'} | status=${cd.status}`);
    }
    for (const t of leadTasks) {
        const td = t.data();
        console.log(`   Queue:   ${t.id} | status=${td.status} | seq=${td.sequenceId} | email=${td.metadata?.email || td.metadata?.contactEmail || 'lookup'} | scheduledAt=${td.scheduledAt?.toDate?.()?.toISOString?.() || td.scheduledAt}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
