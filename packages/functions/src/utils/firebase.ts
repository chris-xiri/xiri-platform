import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Initialize Admin only once
if (!admin.apps.length) {
    let credential: any = admin.credential.applicationDefault();
    const candidateKeys = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        path.resolve(__dirname, "../../../../scripts/serviceAccountKey.json"),
        path.resolve(__dirname, "../../../scripts/serviceAccountKey.json"),
        path.resolve(__dirname, "../../scripts/serviceAccountKey.json"),
        path.resolve(__dirname, "../service-account.json"),
        path.resolve(__dirname, "../../service-account.json"),
    ].filter(Boolean) as string[];

    for (const keyPath of candidateKeys) {
        if (keyPath && fs.existsSync(keyPath)) {
            try {
                credential = admin.credential.cert(require(keyPath));
                break;
            } catch (e) {}
        }
    }

    admin.initializeApp({
        credential,
        projectId: process.env.GCLOUD_PROJECT || "xiri-facility-solutions",
        storageBucket: "xiri-facility-solutions.firebasestorage.app",
    });
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
