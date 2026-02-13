const admin = require('firebase-admin');

// Initialize Firebase Admin
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';

admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const auth = admin.auth();
const db = admin.firestore();

const targetEmail = 'admin@xiri.ai';

async function diagnoseUser() {
    console.log(`Diagnosing user: ${targetEmail}`);

    try {
        // 1. Check Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(targetEmail);
            console.log('✅ Auth User Found:', {
                uid: userRecord.uid,
                email: userRecord.email,
                emailVerified: userRecord.emailVerified
            });
        } catch (e) {
            console.error('❌ Auth User NOT Found:', e.message);
            return;
        }

        // 2. Check Firestore Profile
        console.log(`Checking Firestore path: users/${userRecord.uid}`);
        const userDoc = await db.collection('users').doc(userRecord.uid).get();

        if (userDoc.exists) {
            console.log('✅ Firestore Profile Found:', userDoc.data());
        } else {
            console.error('❌ Firestore Profile NOT Found!');
            console.log('Attempting to list all users in Firestore...');
            const usersSnapshot = await db.collection('users').get();
            if (usersSnapshot.empty) {
                console.log('⚠️ No documents found in "users" collection.');
            } else {
                console.log(`Found ${usersSnapshot.size} user documents:`);
                usersSnapshot.forEach(doc => {
                    console.log(` - ${doc.id}: ${JSON.stringify(doc.data())}`);
                });
            }
        }

    } catch (error) {
        console.error('Diagnostic error:', error);
    }
}

diagnoseUser();
