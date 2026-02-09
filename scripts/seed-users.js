const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
    projectId: 'xiri-platform',
});

const db = admin.firestore();
const auth = admin.auth();

// Connect to emulators if in development
if (process.env.NODE_ENV !== 'production') {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    console.log('🔧 Connected to Firestore Emulator (localhost:8080)');
    console.log('🔧 Connected to Auth Emulator (localhost:9099)');
}

async function seedUsers() {
    console.log('🌱 Seeding users...\n');

    const users = [
        {
            uid: 'admin-user-001',
            email: 'admin@xiri.ai',
            displayName: 'Admin User',
            roles: ['admin'],
            password: 'Admin123!', // Change in production
        },
        {
            uid: 'recruiter-user-001',
            email: 'recruiter@xiri.ai',
            displayName: 'Recruiter User',
            roles: ['recruiter'],
            password: 'Recruiter123!',
        },
        {
            uid: 'sales-user-001',
            email: 'sales@xiri.ai',
            displayName: 'Sales User',
            roles: ['sales'],
            password: 'Sales123!',
        },
    ];

    for (const userData of users) {
        try {
            // Create user in Firebase Auth
            let userRecord;
            try {
                userRecord = await admin.auth().createUser({
                    uid: userData.uid,
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                });
                console.log(`✅ Created Auth user: ${userData.email}`);
            } catch (error) {
                if (error.code === 'auth/uid-already-exists') {
                    console.log(`⚠️  Auth user already exists: ${userData.email}`);
                    userRecord = await admin.auth().getUser(userData.uid);
                } else {
                    throw error;
                }
            }

            // Create user document in Firestore
            const userDoc = {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                roles: userData.roles,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            };

            await db.collection('users').doc(userData.uid).set(userDoc, { merge: true });
            console.log(`✅ Created Firestore doc: ${userData.email} (${userData.roles.join(', ')})\n`);
        } catch (error) {
            console.error(`❌ Error creating user ${userData.email}:`, error.message);
        }
    }

    console.log('\n🎉 User seeding complete!\n');
    console.log('📋 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    users.forEach(user => {
        console.log(`${user.displayName}:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Password: ${user.password}`);
        console.log(`  Roles: ${user.roles.join(', ')}\n`);
    });
}

seedUsers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });
