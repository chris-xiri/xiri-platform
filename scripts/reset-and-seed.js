/**
 * reset-and-seed.js
 * 
 * Wipes the PRODUCTION Firestore database and Auth, then seeds 7 test users.
 * 
 * Usage: node scripts/reset-and-seed.js
 * Requires: Firebase CLI logged in with access to xiri-facility-solutions
 */

const admin = require('firebase-admin');

// ─── PRODUCTION CONFIG (no emulator env vars) ────────────────────────────────

admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const auth = admin.auth();
const db = admin.firestore();

// ─── Users to Seed ───────────────────────────────────────────────────────────

const users = [
    {
        uid: 'admin-001',
        email: 'admin@xiri.ai',
        password: 'Admin123!',
        displayName: 'Chris Leung',
        roles: ['admin'],
    },
    {
        uid: 'sales-001',
        email: 'sales1@xiri.ai',
        password: 'Sales123!',
        displayName: 'Alex Rivera',
        roles: ['sales'],
    },
    {
        uid: 'sales-002',
        email: 'sales2@xiri.ai',
        password: 'Sales123!',
        displayName: 'Jordan Kim',
        roles: ['sales'],
    },
    {
        uid: 'fsm-001',
        email: 'fsm1@xiri.ai',
        password: 'Fsm123!',
        displayName: 'Marcus Chen',
        roles: ['fsm'],
    },
    {
        uid: 'fsm-002',
        email: 'fsm2@xiri.ai',
        password: 'Fsm123!',
        displayName: 'Sarah Okonkwo',
        roles: ['fsm'],
    },
    {
        uid: 'nightmgr-001',
        email: 'night1@xiri.ai',
        password: 'Night123!',
        displayName: 'David Torres',
        roles: ['night_manager'],
    },
    {
        uid: 'nightmgr-002',
        email: 'night2@xiri.ai',
        password: 'Night123!',
        displayName: 'Lisa Patel',
        roles: ['night_manager'],
    },
];

// ─── Known Collections to Delete ─────────────────────────────────────────────

const COLLECTIONS_TO_DELETE = [
    'leads',
    'lead_activities',
    'vendors',
    'vendor_activities',
    'quotes',
    'contracts',
    'work_orders',
    'invoices',
    'audits',
    'commissions',
    'commission_payouts',
    'nrr_snapshots',
    'mail_queue',
    'outbound_tasks',
    'activity_logs',
    'waitlist',
    'corporate_settings',
    'agent_configs',
    'email_templates',
    // 'users' is handled separately — we delete and re-create
];

// ─── Step 1: Clear Firestore ─────────────────────────────────────────────────

async function deleteCollection(collectionPath) {
    const collectionRef = db.collection(collectionPath);
    const batchSize = 100;
    let deleted = 0;

    while (true) {
        const snapshot = await collectionRef.limit(batchSize).get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deleted += snapshot.size;
    }

    return deleted;
}

async function clearFirestore() {
    console.log('\n🗑️  Clearing Firestore collections...');

    // Delete known collections
    for (const col of COLLECTIONS_TO_DELETE) {
        const count = await deleteCollection(col);
        if (count > 0) {
            console.log(`   🧹 ${col}: deleted ${count} docs`);
        } else {
            console.log(`   ⬜ ${col}: empty`);
        }
    }

    // Also delete the users collection (will be re-seeded)
    const userCount = await deleteCollection('users');
    console.log(`   🧹 users: deleted ${userCount} docs (will re-seed)`);

    console.log('   ✅ Firestore cleared.');
}

// ─── Step 2: Clear Auth ──────────────────────────────────────────────────────

async function clearAuth() {
    console.log('\n🗑️  Clearing Auth users...');

    let totalDeleted = 0;
    let nextPageToken;

    do {
        const listResult = await auth.listUsers(1000, nextPageToken);
        if (listResult.users.length === 0) break;

        const uids = listResult.users.map(u => u.uid);
        const result = await auth.deleteUsers(uids);
        totalDeleted += result.successCount;
        nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`   ✅ Deleted ${totalDeleted} auth users.`);
}

// ─── Step 3: Seed Users ──────────────────────────────────────────────────────

async function seedUsers() {
    console.log('\n👤 Seeding users...');

    for (const user of users) {
        try {
            const userRecord = await auth.createUser({
                uid: user.uid,
                email: user.email,
                password: user.password,
                displayName: user.displayName,
                emailVerified: true,
            });

            await db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email: user.email,
                displayName: user.displayName,
                roles: user.roles,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: null,
            });

            const roleLabel = user.roles.join(', ');
            console.log(`   ✅ ${user.displayName.padEnd(18)} | ${user.email.padEnd(20)} | ${roleLabel}`);

        } catch (error) {
            console.error(`   ❌ Failed to seed ${user.email}:`, error.message);
        }
    }
}

// ─── Step 4: Seed a Ready Vendor ────────────────────────────────────────────

async function seedReadyVendor() {
    console.log('\n🏢 Seeding ready-for-assignment vendor...');

    const vendorData = {
        businessName: 'Premier Clean Services',
        contactName: 'Maria Rodriguez',
        email: 'maria@premierclean.com',
        phone: '(713) 555-0142',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        address: '2847 Westheimer Rd, Houston, TX 77098',
        capabilities: ['Janitorial', 'Floor Care', 'Deep Cleaning', 'Disinfection', 'Window Cleaning'],
        serviceTypes: ['Nightly Janitorial', 'Day Porter', 'Floor Care', 'Window Cleaning'],
        fitScore: 94,
        status: 'ready_for_assignment',
        verified: true,
        insuranceVerified: true,
        insuranceExpiry: new Date('2027-01-15'),
        coverageArea: ['Houston', 'Katy', 'Sugar Land', 'The Woodlands', 'Pasadena'],
        employeeCount: 12,
        yearsInBusiness: 8,
        monthlyCapacity: 15,
        hourlyRate: 28,
        notes: 'Reliable janitorial team, specializes in medical office cleaning. OSHA certified. Available for nightly shifts.',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('vendors').add(vendorData);
    console.log(`   ✅ ${vendorData.businessName} (${ref.id}) — status: ready_for_assignment`);
    console.log(`      Coverage: ${vendorData.coverageArea.join(', ')}`);
    console.log(`      Services: ${vendorData.serviceTypes.join(', ')}`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  XIRI PRODUCTION Reset & Seed');
    console.log('  Project: xiri-facility-solutions');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('  ⚠️  This will DELETE all data in production!');
    console.log('');

    await clearFirestore();
    await clearAuth();
    await seedUsers();
    await seedReadyVendor();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ Done! Login credentials:');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('  Admin:         admin@xiri.ai      / Admin123!');
    console.log('  Sales #1:      sales1@xiri.ai     / Sales123!');
    console.log('  Sales #2:      sales2@xiri.ai     / Sales123!');
    console.log('  FSM #1:        fsm1@xiri.ai       / Fsm123!');
    console.log('  FSM #2:        fsm2@xiri.ai       / Fsm123!');
    console.log('  Night Mgr #1:  night1@xiri.ai     / Night123!');
    console.log('  Night Mgr #2:  night2@xiri.ai     / Night123!');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
