const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
    projectId: 'xiri-platform',
});

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const db = admin.firestore();

async function seedFirestoreUsers() {
    console.log('🌱 Seeding Firestore user profiles...\n');

    const users = [
        {
            uid: 'admin-user-001',
            email: 'admin@xiri.ai',
            displayName: 'Admin User',
            roles: ['admin'],
        },
        {
            uid: 'recruiter-user-001',
            email: 'recruiter@xiri.ai',
            displayName: 'Recruiter User',
            roles: ['recruiter'],
        },
        {
            uid: 'sales-user-001',
            email: 'sales@xiri.ai',
            displayName: 'Sales User',
            roles: ['sales'],
        },
    ];

    for (const userData of users) {
        try {
            const userDoc = {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                roles: userData.roles,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLogin: new Date(),
            };

            await db.collection('users').doc(userData.uid).set(userDoc);
            console.log(`✅ Created Firestore profile: ${userData.email} (${userData.roles.join(', ')})`);
        } catch (error) {
            console.error(`❌ Error creating profile for ${userData.email}:`, error.message);
        }
    }

    console.log('\n🎉 Firestore user profiles created!\n');
}

seedFirestoreUsers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });
