/**
 * seed-users.js
 * 
 * Seeds 7 test users into PRODUCTION Firebase Auth + Firestore.
 * Uses the Firebase Client SDK (no service account needed).
 * 
 * Note: Custom UIDs cannot be set with the client SDK — UIDs will be auto-generated.
 * 
 * Usage: node scripts/seed-users.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: 'AIzaSyAuJaxfDonpTwf1iWDvgKIimN_YQWlNdL4',
    authDomain: 'xiri-facility-solutions.firebaseapp.com',
    projectId: 'xiri-facility-solutions',
    storageBucket: 'xiri-facility-solutions.firebasestorage.app',
    messagingSenderId: '289049277463',
    appId: '1:289049277463:web:2cffd52ba7068adffb1852',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const users = [
    {
        email: 'admin@xiri.ai',
        password: 'Admin123!',
        displayName: 'Chris Leung',
        roles: ['admin'],
    },
    {
        email: 'sales1@xiri.ai',
        password: 'Sales123!',
        displayName: 'Alex Rivera',
        roles: ['sales'],
    },
    {
        email: 'sales2@xiri.ai',
        password: 'Sales123!',
        displayName: 'Jordan Kim',
        roles: ['sales'],
    },
    {
        email: 'fsm1@xiri.ai',
        password: 'Fsm123!',
        displayName: 'Marcus Chen',
        roles: ['fsm'],
    },
    {
        email: 'fsm2@xiri.ai',
        password: 'Fsm123!',
        displayName: 'Sarah Okonkwo',
        roles: ['fsm'],
    },
    {
        email: 'night1@xiri.ai',
        password: 'Night123!',
        displayName: 'David Torres',
        roles: ['night_manager'],
    },
    {
        email: 'night2@xiri.ai',
        password: 'Night123!',
        displayName: 'Lisa Patel',
        roles: ['night_manager'],
    },
];

async function seedUsers() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  XIRI User Seeding (Production)');
    console.log('═══════════════════════════════════════════════════\n');

    for (const user of users) {
        try {
            // Create user in Firebase Auth
            const cred = await createUserWithEmailAndPassword(auth, user.email, user.password);

            // Update display name
            await updateProfile(cred.user, { displayName: user.displayName });

            // Write Firestore user profile
            await setDoc(doc(db, 'users', cred.user.uid), {
                uid: cred.user.uid,
                email: user.email,
                displayName: user.displayName,
                roles: user.roles,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastLogin: null,
            });

            // Sign out so we can create the next user
            await signOut(auth);

            const roleLabel = user.roles.join(', ');
            console.log(`  ✅ ${user.displayName.padEnd(18)} | ${user.email.padEnd(20)} | ${roleLabel}`);

        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                console.log(`  ⬜ ${user.email.padEnd(20)} | Already exists — skipped`);
            } else {
                console.error(`  ❌ ${user.email.padEnd(20)} | ${error.message}`);
            }
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ Done! Login credentials:');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('  Admin:         admin@xiri.ai      / Admin123!');
    console.log('  Sales #1:      sales1@xiri.ai     / Sales123!');
    console.log('  Sales #2:      sales2@xiri.ai     / Sales123!');
    console.log('  FSM #1:        fsm1@xiri.ai       / Fsm123!');
    console.log('  FSM #2:        fsm2@xiri.ai       / Fsm123!');
    console.log('  Night Mgr #1:  night1@xiri.ai     / Night123!');
    console.log('  Night Mgr #2:  night2@xiri.ai     / Night123!');
    console.log('');

    process.exit(0);
}

seedUsers().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
