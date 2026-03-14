/**
 * Look up Google Workspace numeric User IDs for Chat @mentions.
 *
 * Uses the Admin SDK Directory API with the Firebase service account.
 * Requires: Admin SDK API enabled + domain-wide delegation on the service account.
 *
 * Simpler alternative: go to admin.google.com → Directory → Users → click a user
 * → the URL will be: admin.google.com/ac/users/USER_ID_HERE
 *
 * Run: npx ts-node packages/functions/src/scripts/lookup-user-id.ts chris@xiri.ai
 */

import * as admin from "firebase-admin";

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS)
if (!admin.apps.length) {
    admin.initializeApp();
}

async function lookupUserId(email: string) {
    console.log(`\nLooking up Google user ID for: ${email}\n`);

    // Method 1: Firebase Auth — gives the Firebase UID
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(`Firebase Auth UID: ${userRecord.uid}`);
        console.log(`Display Name: ${userRecord.displayName}`);
        console.log(`Provider IDs: ${userRecord.providerData.map(p => p.providerId).join(', ')}`);

        // For Google-authenticated users, the provider UID IS the Google numeric ID
        const googleProvider = userRecord.providerData.find(p => p.providerId === 'google.com');
        if (googleProvider) {
            console.log(`\n✅ Google Numeric User ID: ${googleProvider.uid}`);
            console.log(`\nUse this in Chat mentions: <users/${googleProvider.uid}>`);
        } else {
            console.log(`\n⚠️  User is not Google-authenticated (email/password login).`);
            console.log(`   For Chat mentions, find the ID in Google Admin Console:`);
            console.log(`   admin.google.com → Directory → Users → click user → ID is in the URL`);
        }
    } catch (err: any) {
        console.error(`Error looking up ${email}:`, err.message);
    }
}

const email = process.argv[2] || "chris@xiri.ai";
lookupUserId(email).then(() => process.exit(0));
