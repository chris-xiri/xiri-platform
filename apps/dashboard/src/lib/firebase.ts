import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    connectFirestoreEmulator,
    type Firestore,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Firebase configuration - use environment variables for production
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "xiri-facility-solutions.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "xiri-facility-solutions",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "xiri-facility-solutions.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_ID || "289049277463",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:289049277463:web:2cffd52ba7068adffb1852"
};

// Initialize Firebase safely across HMR / SSR
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestore(): Firestore {
    if (typeof window === "undefined") {
        return getFirestore(app);
    }
    try {
        // Enable IndexedDB offline persistence across tabs for PWA resilience
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
            }),
        });
    } catch {
        // Already initialized (HMR) or IndexedDB unavailable (private mode)
        return getFirestore(app);
    }
}

export const db = createFirestore();
export const functions = getFunctions(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Connect to emulators only when explicitly opted in via NEXT_PUBLIC_USE_EMULATORS=true
const globalForEmulators = globalThis as typeof globalThis & { __xiriEmulatorsConnected?: boolean };
if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === "true" &&
    !globalForEmulators.__xiriEmulatorsConnected
) {
    globalForEmulators.__xiriEmulatorsConnected = true;
    console.log("Connecting to Firebase Emulators...");
    connectFirestoreEmulator(db, "127.0.0.1", 8085);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectStorageEmulator(storage, "127.0.0.1", 9199);
}
