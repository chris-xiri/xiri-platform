const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
    projectId: 'demo-test'
});

const db = admin.firestore();
db.settings({
    host: '127.0.0.1:8085',
    ssl: false
});

// Fetch the most recent vendor with compliance data
db.collection('vendors')
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get()
    .then(snapshot => {
        if (snapshot.empty) {
            console.log('❌ No vendors found');
            process.exit(1);
        }

        // Find first vendor with compliance data
        let vendorDoc = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.compliance && !vendorDoc) {
                vendorDoc = { id: doc.id, ...data };
            }
        });

        if (!vendorDoc) {
            console.log('⚠️  No vendors with compliance data found');
            console.log('\nShowing latest vendor anyway:\n');
            const firstDoc = snapshot.docs[0];
            vendorDoc = { id: firstDoc.id, ...firstDoc.data() };
        }

        console.log('\n📋 VENDOR ONBOARDING DATA');
        console.log('========================\n');
        console.log(`🆔 Vendor ID: ${vendorDoc.id}\n`);

        console.log('🏢 Business Info:');
        console.log(`   Company: ${vendorDoc.businessName || 'N/A'}`);
        console.log(`   Email: ${vendorDoc.email || 'N/A'}`);
        console.log(`   Phone: ${vendorDoc.phone || 'N/A'}`);
        console.log(`   Status: ${vendorDoc.status || 'N/A'}\n`);

        if (vendorDoc.compliance) {
            console.log('✅ COMPLIANCE ANSWERS (From Onboarding Form):');
            console.log('   ═══════════════════════════════════════════\n');
            console.log(`   📋 Business Entity (LLC/Corp): ${vendorDoc.compliance.hasBusinessEntity ? '✓ YES' : '✗ NO'}`);
            console.log(`   🛡️  General Liability Insurance: ${vendorDoc.compliance.generalLiability?.hasInsurance ? '✓ YES' : '✗ NO'}`);
            console.log(`   👷 Workers Compensation: ${vendorDoc.compliance.workersComp?.hasInsurance ? '✓ YES' : '✗ NO'}`);
            console.log(`   🚗 Commercial Auto Insurance: ${vendorDoc.compliance.autoInsurance?.hasInsurance ? '✓ YES' : '✗ NO'}`);

            if (vendorDoc.compliance.additionalInsurance) {
                console.log('\n   🔬 Additional Insurance:');
                vendorDoc.compliance.additionalInsurance.forEach(ins => {
                    console.log(`      ${ins.type}: ${ins.hasInsurance ? '✓ YES' : '✗ NO'}`);
                });
            }

            console.log('\n   📄 W-9 Collected: ' + (vendorDoc.compliance.w9Collected ? '✓ YES' : '✗ NO'));
        } else {
            console.log('⚠️  No compliance data found - vendor hasn\'t completed onboarding form yet');
        }

        console.log('\n📅 Timestamps:');
        console.log(`   Created: ${vendorDoc.createdAt?.toDate?.() || 'N/A'}`);
        console.log(`   Updated: ${vendorDoc.updatedAt?.toDate?.() || 'N/A'}`);

        console.log('\n💡 To view in Dashboard:');
        console.log(`   1. Go to http://localhost:3001`);
        console.log(`   2. Navigate to Supply → Recruitment or CRM`);
        console.log(`   3. Click on vendor: ${vendorDoc.businessName || vendorDoc.id}`);
        console.log(`   4. Look for "Compliance" tab or section\n`);

        process.exit(0);
    })
    .catch(error => {
        console.error('Error fetching vendors:', error);
        process.exit(1);
    });
