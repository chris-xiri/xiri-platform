
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Replace with your actual project config if deploying, 
// but for emulators, the projectId matters most.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "xiri-platform.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "xiri-platform",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "xiri-platform.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID || "123456789",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
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
