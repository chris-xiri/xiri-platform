/**
 * Cleanup script: Delete Shivam Urgent Care test contracts, work orders,
 * commissions, and related data from Firestore.
 *
 * Usage: node scripts/cleanup-shivam-test.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function cleanup() {
    console.log('🔍 Searching for Shivam Urgent Care data...\n');

    // 1. Find leads matching "Shivam"
    const leadsSnap = await db.collection('leads').get();
    const shivamLeads = leadsSnap.docs.filter(d => {
        const data = d.data();
        const name = (data.businessName || data.companyName || data.name || '').toLowerCase();
        return name.includes('shivam');
    });

    console.log(`Found ${shivamLeads.length} lead(s)`);
    const leadIds = shivamLeads.map(d => d.id);

    // 2. Find contracts for those leads
    let contractIds = [];
    for (const leadId of leadIds) {
        const snap = await db.collection('contracts').where('leadId', '==', leadId).get();
        snap.docs.forEach(d => contractIds.push(d.id));
    }
    console.log(`Found ${contractIds.length} contract(s)`);

    // 3. Find work orders for those leads
    let workOrderIds = [];
    for (const leadId of leadIds) {
        const snap = await db.collection('work_orders').where('leadId', '==', leadId).get();
        snap.docs.forEach(d => workOrderIds.push(d.id));
    }
    console.log(`Found ${workOrderIds.length} work order(s)`);

    // 4. Find quotes for those leads
    let quoteIds = [];
    for (const leadId of leadIds) {
        const snap = await db.collection('quotes').where('leadId', '==', leadId).get();
        snap.docs.forEach(d => quoteIds.push(d.id));
    }
    console.log(`Found ${quoteIds.length} quote(s)`);

    // 5. Find commissions for those quotes
    let commissionIds = [];
    for (const quoteId of quoteIds) {
        const snap = await db.collection('commissions').where('quoteId', '==', quoteId).get();
        snap.docs.forEach(d => commissionIds.push(d.id));
    }
    console.log(`Found ${commissionIds.length} commission(s)`);

    // 6. Find commission_ledger entries
    let ledgerIds = [];
    for (const commId of commissionIds) {
        const snap = await db.collection('commission_ledger').where('commissionId', '==', commId).get();
        snap.docs.forEach(d => ledgerIds.push(d.id));
    }
    console.log(`Found ${ledgerIds.length} ledger entries`);

    // 7. Find invoices for those contracts
    let invoiceIds = [];
    for (const contractId of contractIds) {
        const snap = await db.collection('invoices').where('contractId', '==', contractId).get();
        snap.docs.forEach(d => invoiceIds.push(d.id));
    }
    console.log(`Found ${invoiceIds.length} invoice(s)`);

    // Summary
    const totalDocs = leadIds.length + contractIds.length + workOrderIds.length +
        quoteIds.length + commissionIds.length + ledgerIds.length + invoiceIds.length;

    if (totalDocs === 0) {
        console.log('\n✅ No Shivam Urgent Care data found. Nothing to delete.');
        process.exit(0);
    }

    console.log(`\n🗑️  Deleting ${totalDocs} documents...\n`);

    // Delete in order: deepest first
    const batch = db.batch();
    for (const id of ledgerIds) batch.delete(db.collection('commission_ledger').doc(id));
    for (const id of commissionIds) batch.delete(db.collection('commissions').doc(id));
    for (const id of invoiceIds) batch.delete(db.collection('invoices').doc(id));
    for (const id of workOrderIds) batch.delete(db.collection('work_orders').doc(id));
    for (const id of contractIds) batch.delete(db.collection('contracts').doc(id));
    for (const id of quoteIds) batch.delete(db.collection('quotes').doc(id));
    for (const id of leadIds) batch.delete(db.collection('leads').doc(id));

    await batch.commit();

    console.log('✅ Done! Deleted:');
    console.log(`   ${leadIds.length} leads`);
    console.log(`   ${quoteIds.length} quotes`);
    console.log(`   ${contractIds.length} contracts`);
    console.log(`   ${workOrderIds.length} work orders`);
    console.log(`   ${commissionIds.length} commissions`);
    console.log(`   ${ledgerIds.length} ledger entries`);
    console.log(`   ${invoiceIds.length} invoices`);

    process.exit(0);
}

cleanup().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
