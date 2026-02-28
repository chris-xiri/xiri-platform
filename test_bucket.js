// Quick test: check default bucket name and test upload
const admin = require("firebase-admin");

// Init with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "xiri-facility-solutions",
        storageBucket: "xiri-facility-solutions.firebasestorage.app",
    });
}

async function testBucket() {
    try {
        // Test 1: What does getStorage().bucket() resolve to?
        const defaultBucket = admin.storage().bucket();
        console.log("Default bucket name:", defaultBucket.name);

        // Test 2: Try uploading a tiny test file
        const testFileName = "social-images/_test_bucket_check.txt";
        const file = defaultBucket.file(testFileName);
        await file.save("test upload " + new Date().toISOString(), {
            metadata: { contentType: "text/plain" },
        });
        console.log("Upload succeeded to:", `gs://${defaultBucket.name}/${testFileName}`);

        // Test 3: Make it public and get URL
        await file.makePublic();
        const url = `https://storage.googleapis.com/${defaultBucket.name}/${testFileName}`;
        console.log("Public URL:", url);

        // Cleanup
        await file.delete();
        console.log("Cleanup done (test file deleted)");

    } catch (err) {
        console.error("Error:", err.message);
        if (err.code) console.error("   Code:", err.code);
    }
    process.exit(0);
}

testBucket();
