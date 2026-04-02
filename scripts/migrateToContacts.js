/**
 * Migrate leads → companies + contacts (contact-centric CRM)
 *
 * For each doc in the `leads` collection:
 * 1. Creates a `companies/{sameLeadId}` document with company-level fields
 *    (same ID as the lead so all existing references — work orders, contracts,
 *     invoices, etc. — continue to work via companyId = leadId)
 * 2. Creates a `contacts/{autoId}` document for the primary contact extracted
 *    from the lead's contactName / email / contactPhone fields
 * 3. Sets `primaryContactId` on the `companies` doc (not the lead)
 *
 * Modes:
 *   DRY RUN (default):  node scripts/migrateToContacts.js
 *   EXECUTE:            node scripts/migrateToContacts.js --execute
 *
 * The original `leads` collection is left untouched for backward compatibility.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Split "John Smith" → { firstName: "John", lastName: "Smith" }
 */
function splitName(fullName) {
    if (!fullName || !fullName.trim()) return { firstName: '', lastName: '' };
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

// Company-level fields to copy from the lead
const COMPANY_FIELDS = [
    'businessName', 'facilityType', 'address', 'city', 'state', 'zip', 'zipCode',
    'website', 'leadType', 'status', 'notes', 'attribution', 'createdAt',
    'serviceInterest', 'preferredAuditTimes', 'propertySourcing',
    'outreachStatus', 'outreachSentAt', 'handedOffToFsm', 'handoffDate',
    'sqft', 'source', 'calculatorData', 'externalIds',
    'locations', 'assignedFsmId', 'contractId', 'wonAt',
];

// Contact-level fields that we extract (will NOT be on the company)
const CONTACT_FIELDS = ['contactName', 'contactPhone', 'email', 'unsubscribed', 'unsubscribedAt'];

async function migrate() {
    const isExecute = process.argv.includes('--execute');
    const mode = isExecute ? '🔴 EXECUTE' : '🟢 DRY RUN';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Contact-Centric CRM Migration — ${mode}`);
    console.log(`  leads → companies + contacts`);
    console.log(`${'='.repeat(60)}\n`);

    if (!isExecute) {
        console.log('  ℹ️  Pass --execute to apply changes.\n');
    }

    // ─── Read all leads ───
    const leadsSnap = await db.collection('leads').get();
    console.log(`  📊 Found ${leadsSnap.size} leads to process.\n`);

    if (leadsSnap.empty) {
        console.log('  No leads to migrate. Exiting.');
        return;
    }

    // ─── Check for existing companies (resumability) ───
    const existingCompaniesSnap = await db.collection('companies').get();
    const existingCompanyIds = new Set();
    existingCompaniesSnap.forEach(doc => {
        existingCompanyIds.add(doc.id);
    });

    if (existingCompanyIds.size > 0) {
        console.log(`  ⚠️  Found ${existingCompanyIds.size} existing companies. These will be skipped.\n`);
    }

    // ─── Check for existing contacts ───
    const existingContactsSnap = await db.collection('contacts').get();
    const existingContactCompanyIds = new Set();
    existingContactsSnap.forEach(doc => {
        const data = doc.data();
        if (data.companyId) existingContactCompanyIds.add(data.companyId);
    });

    // ─── Process leads ───
    const results = {
        companiesCreated: 0,
        contactsCreated: 0,
        skippedExistingCompany: 0,
        skippedExistingContact: 0,
        skippedNoContact: 0,
        errors: 0,
    };

    const mapping = []; // { leadId, businessName, contactId, contactName, email }

    const BATCH_LIMIT = 400; // Stay well under 500 Firestore limit
    let batch = db.batch();
    let batchOps = 0;

    async function commitBatch() {
        if (batchOps > 0 && isExecute) {
            await batch.commit();
            console.log(`  ✅ Committed batch of ${batchOps} operations...`);
            batch = db.batch();
            batchOps = 0;
        }
    }

    for (const doc of leadsSnap.docs) {
        const lead = doc.data();
        const leadId = doc.id;

        // ─── 1. Create Company ───
        if (existingCompanyIds.has(leadId)) {
            results.skippedExistingCompany++;
        } else {
            const companyData = {};

            // Copy company-level fields
            for (const field of COMPANY_FIELDS) {
                if (lead[field] !== undefined && lead[field] !== null) {
                    companyData[field] = lead[field];
                }
            }

            // Ensure required fields
            companyData.businessName = companyData.businessName || 'Unnamed';
            companyData.status = companyData.status || 'new';
            companyData.createdAt = companyData.createdAt || admin.firestore.FieldValue.serverTimestamp();
            companyData.migratedFrom = 'leads';
            companyData.migratedAt = admin.firestore.FieldValue.serverTimestamp();

            // Use the SAME doc ID as the lead for referential integrity
            const companyRef = db.collection('companies').doc(leadId);

            if (isExecute) {
                batch.set(companyRef, companyData);
                batchOps++;
            }

            results.companiesCreated++;
        }

        // ─── 2. Create Contact (extract from lead) ───
        if (existingContactCompanyIds.has(leadId)) {
            results.skippedExistingContact++;
        } else if (!lead.email && !lead.contactName) {
            results.skippedNoContact++;
            console.log(`  ⏭️  ${leadId} "${lead.businessName}" — no email or contactName, skipping contact.`);
        } else {
            const { firstName, lastName } = splitName(lead.contactName || '');
            const contactData = {
                firstName,
                lastName,
                email: lead.email || '',
                phone: lead.contactPhone || '',
                companyId: leadId,
                companyName: lead.businessName || '',
                role: 'Owner',
                isPrimary: true,
                unsubscribed: lead.unsubscribed || false,
                notes: '',
                createdAt: lead.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'migration',
            };

            if (lead.unsubscribedAt) {
                contactData.unsubscribedAt = lead.unsubscribedAt;
            }

            // Remove empty strings for cleanliness (except firstName/lastName which may legitimately be empty)
            Object.keys(contactData).forEach(key => {
                if (contactData[key] === undefined) {
                    delete contactData[key];
                }
            });

            const contactRef = db.collection('contacts').doc(); // auto-ID
            const contactId = contactRef.id;

            if (isExecute) {
                batch.set(contactRef, contactData);
                batchOps++;

                // Also set primaryContactId on the company doc
                const companyRef = db.collection('companies').doc(leadId);
                batch.update(companyRef, { primaryContactId: contactId });
                batchOps++;
            }

            mapping.push({
                leadId,
                businessName: lead.businessName,
                contactId,
                contactName: `${firstName} ${lastName}`.trim(),
                email: lead.email || '',
            });

            results.contactsCreated++;
        }

        // Commit if approaching limit
        if (batchOps >= BATCH_LIMIT) {
            await commitBatch();
        }
    }

    // Commit remaining
    await commitBatch();

    // ─── Report ───
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Migration Results (${mode})`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  🏢 Companies to create:      ${results.companiesCreated}`);
    console.log(`  👤 Contacts to create:        ${results.contactsCreated}`);
    console.log(`  ⏭️  Skipped (existing co.):    ${results.skippedExistingCompany}`);
    console.log(`  ⏭️  Skipped (existing contact): ${results.skippedExistingContact}`);
    console.log(`  ⏭️  Skipped (no contact info):  ${results.skippedNoContact}`);
    console.log(`  ❌ Errors:                    ${results.errors}`);
    console.log(`  📊 Total leads processed:     ${leadsSnap.size}`);

    // Print sample mapping
    if (mapping.length > 0) {
        const sample = mapping.slice(0, 20);
        console.log(`\n  Contact mapping (showing ${sample.length} of ${mapping.length}):`);
        console.log(`  ${'─'.repeat(56)}`);
        sample.forEach(m => {
            console.log(`  ${m.leadId.substring(0, 12)}… → ${m.contactId.substring(0, 12)}…  ${m.contactName || '(no name)'} <${m.email || 'no-email'}>`);
        });
        if (mapping.length > 20) {
            console.log(`  ... and ${mapping.length - 20} more.`);
        }
    }

    console.log(`\n  ✅ Migration ${isExecute ? 'COMPLETED' : 'DRY RUN complete'}.\n`);
}

migrate().catch(err => {
    console.error('\n  ❌ Migration failed:', err);
    process.exit(1);
});
