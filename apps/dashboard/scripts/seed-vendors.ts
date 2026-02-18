import { db } from './lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const testVendors = [
    {
        businessName: "Clean Pro Services",
        contactName: "John Smith",
        email: "john@cleanpro.com",
        phone: "(555) 123-4567",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        capabilities: ["Janitorial", "Floor Care", "Window Cleaning"],
        fitScore: 85,
        status: "qualified",
        createdAt: serverTimestamp()
    },
    {
        businessName: "Elite Maintenance Co",
        contactName: "Sarah Johnson",
        email: "sarah@elitemaint.com",
        phone: "(555) 234-5678",
        city: "Houston",
        state: "TX",
        zip: "77001",
        capabilities: ["HVAC", "Plumbing", "Electrical"],
        fitScore: 92,
        status: "pending_review",
        createdAt: serverTimestamp()
    },
    {
        businessName: "Facility Solutions LLC",
        contactName: "Mike Davis",
        email: "mike@facilitysolutions.com",
        phone: "(555) 345-6789",
        city: "Phoenix",
        state: "AZ",
        zip: "85001",
        capabilities: ["General Maintenance", "Landscaping", "Snow Removal"],
        fitScore: 78,
        status: "pending_review",
        createdAt: serverTimestamp()
    },
    {
        businessName: "Quick Fix Contractors",
        contactName: "Lisa Martinez",
        email: "lisa@quickfix.com",
        phone: "(555) 456-7890",
        city: "Philadelphia",
        state: "PA",
        zip: "19019",
        capabilities: ["Carpentry", "Painting", "Drywall"],
        fitScore: 88,
        status: "qualified",
        createdAt: serverTimestamp()
    },
    {
        businessName: "Green Clean Services",
        contactName: "Tom Wilson",
        email: "tom@greenclean.com",
        phone: "(555) 567-8901",
        city: "San Antonio",
        state: "TX",
        zip: "78201",
        capabilities: ["Eco-Friendly Cleaning", "Janitorial", "Carpet Cleaning"],
        fitScore: 81,
        status: "pending_review",
        createdAt: serverTimestamp()
    }
];

async function seedVendors() {
    try {
        const vendorsRef = collection(db, 'vendors');

        for (const vendor of testVendors) {
            await addDoc(vendorsRef, vendor);
            console.log(`✅ Added vendor: ${vendor.businessName}`);
        }

        console.log('🎉 Successfully seeded 5 test vendors!');
    } catch (error) {
        console.error('❌ Error seeding vendors:', error);
    }
}

// Run the seed function
seedVendors();
