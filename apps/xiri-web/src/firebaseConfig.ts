
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Replace with your actual project config if deploying, 
// but for emulators, the projectId matters most.
const firebaseConfig = {
    apiKey: "demo-key",
    authDomain: "xiri-facility-solutions-485813.firebaseapp.com",
    projectId: "demo-no-project",
    storageBucket: "xiri-facility-solutions-485813.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to Emulators in Development
if (import.meta.env.DEV) {
    console.log("🔥 Connecting to Firebase Emulators...");
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
}
