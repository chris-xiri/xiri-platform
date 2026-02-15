// Direct test of emailUtils using compiled lib
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
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

async function testEmailDirect() {
    try {
        console.log('📧 Testing Resend email integration directly...\n');

        // Import the compiled function
        const { sendTemplatedEmail } = require('../packages/functions/lib/utils/emailUtils');

        console.log('✅ Loaded emailUtils from compiled lib');
        console.log('📝 Vendor ID: test-vendor-resend-1');
        console.log('📋 Template ID: onboarding_invite');
        console.log('📬 Email: clungz+test1@gmail.com\n');

        console.log('📧 Sending email...');
        await sendTemplatedEmail('test-vendor-resend-1', 'onboarding_invite');

        console.log('\n✅ Email sent successfully!');
        console.log('📬 Check clungz+test1@gmail.com inbox');
        console.log('📊 Check Firestore vendor_activities collection for log entry');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testEmailDirect();
