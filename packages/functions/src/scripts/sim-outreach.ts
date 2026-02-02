import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Init Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "xiri-facility-solutions-485813"
    });
}
const db = admin.firestore();

async function simulateRealOutreach() {
    console.log("Creating test vendor 'Chris' Cleaning'...");

    // 1. Create the Vendor as "PENDING_REVIEW"
    const vendorData = {
        companyName: "Chris' Cleaning",
        location: "New Hyde Park, NY 11040",
        specialty: "Commercial Cleaning",
        status: "PENDING_REVIEW",
        email: "clungz@gmail.com",
        phone: "+15550109999",
        website: "https://chriscleaning.mock",
        businessType: "Independent",
        fitScore: 88,
        createdAt: new Date()
    };

    const ref = await db.collection('vendors').add(vendorData);
    console.log(`Vendor Created: ${ref.id}`);

    // Allow some time for the "onCreated" trigger (Telegram Notif) to supposedly fire/finish
    await new Promise(r => setTimeout(r, 2000));

    console.log("Simulating Approval (Triggering Outreach Agent)...");

    // 2. Approve the Vendor
    // This should trigger 'onVendorApproved' -> 'performOutreach' -> 'sendEmailOutreach'
    await ref.update({ status: 'APPROVED' });

    console.log("Vendor Approved. Check your inbox (clungz@gmail.com) in a few seconds!");
}

simulateRealOutreach().catch(console.error);
