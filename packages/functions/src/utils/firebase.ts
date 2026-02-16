import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize Admin only once
if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = admin.firestore();

// Global Firestore Settings
// ignoreUndefinedProperties: true allows us to save objects with undefined fields (e.g. missing optional data)
try {
    db.settings({ ignoreUndefinedProperties: true });
} catch (error) {
    // Ignore error if settings already applied
    console.log("Firestore settings usage note:", error);
}

export { admin };
