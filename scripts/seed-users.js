const admin = require('firebase-admin');

// Initialize Firebase Admin
// We rely on FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST env vars
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';

admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const auth = admin.auth();
const db = admin.firestore();

const users = [
    {
        uid: 'test-user-admin',
        email: 'admin@xiri.ai',
        password: 'Admin123!',
        displayName: 'Admin User',
        roles: ['admin'],
    },
    {
        uid: 'test-user-recruiter',
        email: 'recruiter@xiri.ai',
        password: 'Recruiter123!',
        displayName: 'Recruiter User',
        roles: ['recruiter'],
    },
    {
        uid: 'test-user-sales',
        email: 'sales@xiri.ai',
        password: 'Sales123!',
        displayName: 'Sales User',
        roles: ['sales'],
    },
    {
        uid: 'test-user-fsm',
        email: 'fsm@xiri.ai',
        password: 'FsmUser123!',
        displayName: 'FSM User',
        roles: ['fsm'],
    },
];

async function seedUsers() {
    console.log('Starting seed process...');

    for (const user of users) {
        try {
            let userRecord;
            try {
                // Check if user exists
                const existingUser = await auth.getUserByEmail(user.email);
                console.log(`User ${user.email} exists with UID ${existingUser.uid}. Deleting to enforce specific UID...`);
                await auth.deleteUser(existingUser.uid);
            } catch (error) {
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
                // User doesn't exist, proceed
            }

            console.log(`Creating user ${user.email} with UID ${user.uid}...`);
            userRecord = await auth.createUser({
                uid: user.uid,
                email: user.email,
                password: user.password,
                displayName: user.displayName,
                emailVerified: true,
            });

            // Set Firestore User Profile
            await db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email: user.email,
                displayName: user.displayName,
                roles: user.roles,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: null,
            }, { merge: true });

            console.log(`Successfully seeded ${user.email} with roles: ${user.roles.join(', ')}`);

        } catch (error) {
            console.error(`Failed to seed user ${user.email}:`, error);
        }
    }

    console.log('Seed process complete.');
}

seedUsers();
