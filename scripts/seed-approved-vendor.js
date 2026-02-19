const admin = require('firebase-admin');
const { applicationDefault } = require('firebase-admin/app');

// Initialize with application-default credentials (from gcloud auth)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions',
        credential: admin.credential.applicationDefault(),
    });
}

const db = admin.firestore();

const approvedVendor = {
    businessName: "Premier Clean Services",
    contactName: "Maria Rodriguez",
    email: "maria@premierclean.com",
    phone: "(713) 555-0142",
    city: "Houston",
    state: "TX",
    zip: "77001",
    address: "2847 Westheimer Rd, Houston, TX 77098",
    capabilities: ["Janitorial", "Floor Care", "Deep Cleaning", "Disinfection", "Window Cleaning"],
    serviceTypes: ["Nightly Janitorial", "Day Porter", "Floor Care", "Window Cleaning"],
    fitScore: 94,
    status: "approved",
    verified: true,
    insuranceVerified: true,
    insuranceExpiry: new Date("2027-01-15"),
    coverageArea: ["Houston", "Katy", "Sugar Land", "The Woodlands", "Pasadena"],
    employeeCount: 12,
    yearsInBusiness: 8,
    monthlyCapacity: 15,
    hourlyRate: 28,
    notes: "Reliable janitorial team, specializes in medical office cleaning. OSHA certified. Available for nightly shifts.",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function seedApprovedVendor() {
    try {
        console.log('🌱 Seeding approved vendor to production...');

        const docRef = await db.collection('vendors').add(approvedVendor);
        console.log(`✅ Added approved vendor: ${approvedVendor.businessName}`);
        console.log(`   ID: ${docRef.id}`);
        console.log(`   Status: ${approvedVendor.status}`);
        console.log(`   Capabilities: ${approvedVendor.capabilities.join(', ')}`);
        console.log(`   Coverage: ${approvedVendor.coverageArea.join(', ')}`);

        console.log('\n🎉 Done! You can now assign this vendor to work orders.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

seedApprovedVendor();
