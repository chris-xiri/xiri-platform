// Simple seed script using fetch to add vendors to Firestore emulator
const vendors = [
    {
        fields: {
            businessName: { stringValue: "Clean Pro Services" },
            contactName: { stringValue: "John Smith" },
            email: { stringValue: "john@cleanpro.com" },
            phone: { stringValue: "(555) 123-4567" },
            city: { stringValue: "Chicago" },
            state: { stringValue: "IL" },
            zip: { stringValue: "60601" },
            address: { stringValue: "123 Main St, Chicago, IL 60601" },
            capabilities: {
                arrayValue: {
                    values: [
                        { stringValue: "Janitorial" },
                        { stringValue: "Floor Care" },
                        { stringValue: "Window Cleaning" }
                    ]
                }
            },
            fitScore: { integerValue: "85" },
            status: { stringValue: "qualified" },
            createdAt: { timestampValue: new Date().toISOString() }
        }
    },
    {
        fields: {
            businessName: { stringValue: "Elite Maintenance Co" },
            contactName: { stringValue: "Sarah Johnson" },
            email: { stringValue: "sarah@elitemaint.com" },
            phone: { stringValue: "(555) 234-5678" },
            city: { stringValue: "Houston" },
            state: { stringValue: "TX" },
            zip: { stringValue: "77001" },
            address: { stringValue: "456 Oak Ave, Houston, TX 77001" },
            capabilities: {
                arrayValue: {
                    values: [
                        { stringValue: "HVAC" },
                        { stringValue: "Plumbing" },
                        { stringValue: "Electrical" }
                    ]
                }
            },
            fitScore: { integerValue: "92" },
            status: { stringValue: "pending_review" },
            createdAt: { timestampValue: new Date().toISOString() }
        }
    },
    {
        fields: {
            businessName: { stringValue: "Facility Solutions LLC" },
            contactName: { stringValue: "Mike Davis" },
            email: { stringValue: "mike@facilitysolutions.com" },
            phone: { stringValue: "(555) 345-6789" },
            city: { stringValue: "Phoenix" },
            state: { stringValue: "AZ" },
            zip: { stringValue: "85001" },
            address: { stringValue: "789 Pine Rd, Phoenix, AZ 85001" },
            capabilities: {
                arrayValue: {
                    values: [
                        { stringValue: "General Maintenance" },
                        { stringValue: "Landscaping" },
                        { stringValue: "Snow Removal" }
                    ]
                }
            },
            fitScore: { integerValue: "78" },
            status: { stringValue: "pending_review" },
            createdAt: { timestampValue: new Date().toISOString() }
        }
    },
    {
        fields: {
            businessName: { stringValue: "Quick Fix Contractors" },
            contactName: { stringValue: "Lisa Martinez" },
            email: { stringValue: "lisa@quickfix.com" },
            phone: { stringValue: "(555) 456-7890" },
            city: { stringValue: "Philadelphia" },
            state: { stringValue: "PA" },
            zip: { stringValue: "19019" },
            address: { stringValue: "321 Elm St, Philadelphia, PA 19019" },
            capabilities: {
                arrayValue: {
                    values: [
                        { stringValue: "Carpentry" },
                        { stringValue: "Painting" },
                        { stringValue: "Drywall" }
                    ]
                }
            },
            fitScore: { integerValue: "88" },
            status: { stringValue: "qualified" },
            createdAt: { timestampValue: new Date().toISOString() }
        }
    },
    {
        fields: {
            businessName: { stringValue: "Green Clean Services" },
            contactName: { stringValue: "Tom Wilson" },
            email: { stringValue: "tom@greenclean.com" },
            phone: { stringValue: "(555) 567-8901" },
            city: { stringValue: "San Antonio" },
            state: { stringValue: "TX" },
            zip: { stringValue: "78201" },
            address: { stringValue: "654 Maple Dr, San Antonio, TX 78201" },
            capabilities: {
                arrayValue: {
                    values: [
                        { stringValue: "Eco-Friendly Cleaning" },
                        { stringValue: "Janitorial" },
                        { stringValue: "Carpet Cleaning" }
                    ]
                }
            },
            fitScore: { integerValue: "81" },
            status: { stringValue: "pending_review" },
            createdAt: { timestampValue: new Date().toISOString() }
        }
    }
];

async function seedVendors() {
    const baseUrl = 'http://localhost:8080/v1/projects/xiri-facility-solutions/databases/(default)/documents/vendors';

    console.log('🌱 Seeding vendors to Firestore emulator...\n');

    for (const vendor of vendors) {
        try {
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(vendor)
            });

            if (response.ok) {
                const data = await response.json();
                const vendorName = vendor.fields.businessName.stringValue;
                console.log(`✅ Added: ${vendorName}`);
            } else {
                console.error(`❌ Failed to add vendor:`, await response.text());
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }

    console.log(`\n🎉 Seeding complete! View at: http://localhost:3001/supply/crm`);
}

seedVendors();
