const admin = require('firebase-admin');

// Initialize Firebase Admin for PRODUCTION
// You need to download the service account key from Firebase Console
// Go to: Project Settings > Service Accounts > Generate New Private Key

const serviceAccount = require('./serviceAccountKey.json'); // You'll need to download this

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'xiri-facility-solutions',
});

const auth = admin.auth();
const db = admin.firestore();

// IMPORTANT: Replace this email with the email you used to log in
const EMAIL_TO_SEED = 'admin@xiri.ai'; // <-- CHANGE THIS TO YOUR EMAIL

async function seedUserProfile() {
    console.log(`Looking for user with email: ${EMAIL_TO_SEED}...`);

    try {
        // Get the user from Firebase Authentication
        const userRecord = await auth.getUserByEmail(EMAIL_TO_SEED);
        console.log(`Found user with UID: ${userRecord.uid}`);

        // Create/update the user profile in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName || 'Admin User',
            roles: ['admin'], // Give admin access
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: null,
        }, { merge: true });

        console.log(`✅ Successfully created user profile for ${userRecord.email}`);
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Roles: admin`);
        console.log('\nYou can now log in with this account!');

    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`❌ User with email ${EMAIL_TO_SEED} not found in Firebase Authentication.`);
            console.error('   Please create the user in Firebase Console first:');
            console.error('   https://console.firebase.google.com/project/xiri-facility-solutions/authentication/users');
        } else {
            console.error('❌ Error:', error);
        }
    }

    process.exit(0);
}

seedUserProfile();
