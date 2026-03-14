/**
 * Quick script to check the googleUserId stored after Google SSO sign-in.
 * Run: npx ts-node packages/functions/src/scripts/check-google-uid.ts
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-facility-solutions" });
}
const db = admin.firestore();

async function main() {
    console.log("\n🔍 Looking up users with googleUserId...\n");

    const snapshot = await db.collection("users")
        .where("email", "==", "chris@xiri.ai")
        .get();

    if (snapshot.empty) {
        // Try getting all users
        const allUsers = await db.collection("users").get();
        console.log(`No users found with chris@xiri.ai. Total users: ${allUsers.size}`);
        allUsers.forEach(doc => {
            const d = doc.data();
            console.log(`  ${doc.id}: ${d.email} | googleUserId: ${d.googleUserId || 'none'} | roles: ${(d.roles||[]).join(',')}`);
        });
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`UID: ${doc.id}`);
        console.log(`Email: ${data.email}`);
        console.log(`Display Name: ${data.displayName}`);
        console.log(`Roles: ${(data.roles || []).join(', ')}`);
        console.log(`Google User ID: ${data.googleUserId || 'NOT SET'}`);
        console.log(`Last Login: ${data.lastLogin?.toDate?.() || data.lastLogin}`);

        if (data.googleUserId) {
            console.log(`\n✅ For Chat mentions, use: <users/${data.googleUserId}>`);
        } else {
            console.log(`\n⚠️ googleUserId not stored yet — try signing in with Google again`);
        }
    });
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
