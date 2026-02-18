const admin = require('firebase-admin');

// Initialize Firebase Admin (it will use the emulator automatically)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions'
    });
}

const db = admin.firestore();

// Use emulator
db.settings({
    host: 'localhost:8080',
    ssl: false
});

const testVendors = [
    {
        businessName: "Clean Pro Services",
        contactName: "John Smith",
        email: "john@cleanpro.com",
        phone: "(555) 123-4567",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        address: "123 Main St, Chicago, IL 60601",
        capabilities: ["Janitorial", "Floor Care", "Window Cleaning"],
        fitScore: 85,
        status: "qualified",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "Elite Maintenance Co",
        contactName: "Sarah Johnson",
        email: "sarah@elitemaint.com",
        phone: "(555) 234-5678",
        city: "Houston",
        state: "TX",
        zip: "77001",
        address: "456 Oak Ave, Houston, TX 77001",
        capabilities: ["HVAC", "Plumbing", "Electrical"],
        fitScore: 92,
        status: "pending_review",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "Facility Solutions LLC",
        contactName: "Mike Davis",
        email: "mike@facilitysolutions.com",
        phone: "(555) 345-6789",
        city: "Phoenix",
        state: "AZ",
        zip: "85001",
        address: "789 Pine Rd, Phoenix, AZ 85001",
        capabilities: ["General Maintenance", "Landscaping", "Snow Removal"],
        fitScore: 78,
        status: "pending_review",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "Quick Fix Contractors",
        contactName: "Lisa Martinez",
        email: "lisa@quickfix.com",
        phone: "(555) 456-7890",
        city: "Philadelphia",
        state: "PA",
        zip: "19019",
        address: "321 Elm St, Philadelphia, PA 19019",
        capabilities: ["Carpentry", "Painting", "Drywall"],
        fitScore: 88,
        status: "qualified",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "Green Clean Services",
        contactName: "Tom Wilson",
        email: "tom@greenclean.com",
        phone: "(555) 567-8901",
        city: "San Antonio",
        state: "TX",
        zip: "78201",
        address: "654 Maple Dr, San Antonio, TX 78201",
        capabilities: ["Eco-Friendly Cleaning", "Janitorial", "Carpet Cleaning"],
        fitScore: 81,
        status: "pending_review",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "Pro Plumbing & HVAC",
        contactName: "Robert Brown",
        email: "robert@proplumbing.com",
        phone: "(555) 678-9012",
        city: "Dallas",
        state: "TX",
        zip: "75201",
        address: "987 Cedar Ln, Dallas, TX 75201",
        capabilities: ["Plumbing", "HVAC", "Water Heaters"],
        fitScore: 90,
        status: "qualified",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "Sparkle Janitorial",
        contactName: "Jennifer Lee",
        email: "jennifer@sparklejan.com",
        phone: "(555) 789-0123",
        city: "Austin",
        state: "TX",
        zip: "78701",
        address: "147 Birch Ave, Austin, TX 78701",
        capabilities: ["Janitorial", "Deep Cleaning", "Disinfection"],
        fitScore: 76,
        status: "pending_review",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        businessName: "All-Star Electrical",
        contactName: "David Kim",
        email: "david@allstarelectric.com",
        phone: "(555) 890-1234",
        city: "Denver",
        state: "CO",
        zip: "80201",
        address: "258 Spruce St, Denver, CO 80201",
        capabilities: ["Electrical", "Lighting", "Generators"],
        fitScore: 87,
        status: "qualified",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
];

async function seedVendors() {
    try {
        console.log('🌱 Starting vendor seed...');

        const vendorsRef = db.collection('vendors');

        for (const vendor of testVendors) {
            const docRef = await vendorsRef.add(vendor);
            console.log(`✅ Added vendor: ${vendor.businessName} (ID: ${docRef.id})`);
        }

        console.log(`\n🎉 Successfully seeded ${testVendors.length} test vendors!`);
        console.log('View them at: http://localhost:3001/supply/crm');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding vendors:', error);
        process.exit(1);
    }
}

seedVendors();
