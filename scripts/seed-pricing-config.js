const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function seed() {
    const config = {
        serviceTag: 'janitorial',
        label: 'Janitorial Cleaning',
        costStack: {
            clientRate: 77,
            subcontractorRate: 50,
            cleanerRate: 25,
            minHours: 1,
        },
        productionRates: {
            office_general: 4250,
            medical_private: 2500,
            medical_dental: 2500,
            medical_veterinary: 2500,
            medical_urgent_care: 1750,
            medical_surgery: 1750,
            medical_dialysis: 1750,
            auto_dealer_showroom: 3500,
            auto_service_center: 3500,
            edu_daycare: 3000,
            edu_private_school: 3000,
            fitness_gym: 3000,
            retail_storefront: 4750,
            lab_cleanroom: 1250,
            lab_bsl: 1250,
            manufacturing_light: 3000,
            other: 3500,
        },
        fixtures: {
            restroomFixtureMinutes: 3,
            trashBinMinutes: 1,
        },
        floorModifiers: {
            carpet: 1.0,
            hardFloor: 0.85,
            tile: 0.80,
            concrete: 1.1,
            vinyl: 0.90,
        },
        shiftModifiers: {
            afterHours: 1.0,
            daytime: 1.15,
            weekend: 1.25,
        },
        addOns: {
            kitchen: 0.10,
            highTouchDisinfection: 0.15,
            entryWayMats: 0.03,
        },
        updatedAt: new Date(),
    };

    await db.collection('pricing_config').doc('janitorial').set(config);
    console.log('✅ Seeded pricing_config/janitorial');
}

seed().catch(console.error);
