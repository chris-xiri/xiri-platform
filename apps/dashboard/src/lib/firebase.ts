import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Firebase configuration - use environment variables for production
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "xiri-facility-solutions.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "xiri-facility-solutions",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "xiri-facility-solutions.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_ID || "289049277463",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:289049277463:web:2cffd52ba7068adffb1852"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);

// Connect to emulators in development
if (process.env.NODE_ENV === "development") {
    console.log("Connecting to Firebase Emulators...");
    connectFirestoreEmulator(db, "127.0.0.1", 8085);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
} else {
    console.log("Connecting to Production Firebase");
}
