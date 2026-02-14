
const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
    apiKey: "demo-key",
    authDomain: "xiri-facility-solutions.firebaseapp.com",
    projectId: "xiri-facility-solutions",
    storageBucket: "xiri-facility-solutions.appspot.com",
    messagingSenderId: "289049277463",
    appId: "1:289049277463:web:2cffd52ba7068adffb1852"
};

async function testClientLogin() {
    console.log("Initializing Client SDK...");
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // Connect to emulator
    console.log("Connecting to Auth Emulator at http://127.0.0.1:9099");
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

    try {
        console.log("Attempting sign in for admin@xiri.ai...");
        const userCredential = await signInWithEmailAndPassword(auth, "admin@xiri.ai", "Admin123!");
        console.log("✅ SUCCESS: Signed in as", userCredential.user.uid);
    } catch (error) {
        console.error("❌ FAILURE:", error.code, error.message);
    }
}

testClientLogin();
