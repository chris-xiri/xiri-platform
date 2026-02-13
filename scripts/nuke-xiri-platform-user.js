const admin = require('firebase-admin');

// Target xiri-platform explicitly
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'xiri-platform';

admin.initializeApp({
    projectId: 'xiri-platform',
});

const auth = admin.auth();

async function nukeUser() {
    const email = 'admin@xiri.ai';
    console.log(`Attempting to nuke ${email} from xiri-platform...`);
    try {
        const user = await auth.getUserByEmail(email);
        console.log(`Found user ${user.uid}. Deleting...`);
        await auth.deleteUser(user.uid);
        console.log('Deleted.');
    } catch (e) {
        console.log('User not found or error:', e.message);
    }
}

nukeUser();
