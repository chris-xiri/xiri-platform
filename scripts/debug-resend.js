// Direct test to check if domain is actually verified
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../packages/functions/.env') });

console.log('🔍 Testing xiri.ai domain with Resend API...\n');

async function testDomainVerification() {
    try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        console.log('📧 Attempting to send from onboarding@xiri.ai...\n');

        const result = await resend.emails.send({
            from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
            to: 'clungz+test2@gmail.com',
            subject: 'Direct Test - Domain Verification',
            html: '<h1>Test Email</h1><p>This is a direct API test to verify xiri.ai domain is working.</p>'
        });

        console.log('✅ Resend API Response:', JSON.stringify(result, null, 2));

        if (result.data) {
            console.log('\n✅ SUCCESS!');
            console.log('   Email ID:', result.data.id);
            console.log('   Check inbox: clungz+test2@gmail.com');
            console.log('   Check Resend dashboard: https://resend.com/emails');
        } else if (result.error) {
            console.log('\n❌ ERROR:', result.error);
            if (result.error.message.includes('not verified')) {
                console.log('\n⚠️  Domain is NOT verified yet!');
                console.log('   Go to: https://resend.com/domains');
                console.log('   Click "Verify" next to xiri.ai');
                console.log('   DNS may need more time to propagate (wait 10-30 minutes)');
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

testDomainVerification();
