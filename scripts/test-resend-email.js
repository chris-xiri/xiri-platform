const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from functions/.env
dotenv.config({ path: path.join(__dirname, '../packages/functions/.env') });

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions'
    });
}

// Set emulator hosts
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const db = admin.firestore();

async function setupTestVendorAndTemplate() {
    try {
        console.log('🧪 Setting up test data for Resend email test...\n');

        // Create test vendor
        const testVendorId = 'test-vendor-resend-1';
        const testVendor = {
            businessName: 'Test Cleaning Co',
            email: 'clungz+test2@gmail.com',
            zipCode: '90210',
            specialty: 'Janitorial',
            address: '123 Main St, Beverly Hills, CA 90210',
            status: 'pending_review',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        console.log(`📝 Creating test vendor: ${testVendorId}`);
        await db.collection('vendors').doc(testVendorId).set(testVendor);
        console.log('✅ Test vendor created');
        console.log(`   Email: ${testVendor.email}`);
        console.log(`   Business: ${testVendor.businessName}\n`);

        // Check if template exists
        console.log('🔍 Checking for email template...');
        const templateDoc = await db.collection('templates').doc('onboarding_invite').get();

        if (!templateDoc.exists) {
            console.log('⚠️  Template not found, creating default template...');
            await db.collection('templates').doc('onboarding_invite').set({
                subject: 'Welcome {{vendorName}} - Complete Your Onboarding',
                content: `Hi {{vendorName}},

We're excited to have you join Xiri Facility Solutions serving the {{zipCode}} area.

As a {{specialty}} professional, you'll benefit from:
- Zero admin work - we handle all the paperwork
- Steady job flow from our medical facility clients
- One simple invoice, one payment

Complete your onboarding here: {{portalLink}}

Looking forward to working with you!

Best regards,
The Xiri Team`,
                variables: ['vendorName', 'zipCode', 'specialty', 'portalLink']
            });
            console.log('✅ Template created\n');
        } else {
            console.log('✅ Template already exists\n');
        }

        console.log('✅ Setup complete!');
        console.log('\n📧 To send the test email, call the Cloud Function:');
        console.log(`   Vendor ID: ${testVendorId}`);
        console.log(`   Template ID: onboarding_invite`);
        console.log('\n💡 You can trigger this via Firebase Emulator UI or create a callable function.');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setupTestVendorAndTemplate();
