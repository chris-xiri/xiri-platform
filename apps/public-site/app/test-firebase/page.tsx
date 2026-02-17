"use client";

import { useEffect, useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FirebaseTestPage() {
    const [status, setStatus] = useState("Testing...");
    const [error, setError] = useState("");

    useEffect(() => {
        const test = async () => {
            try {
                console.log("1. Starting Firebase test...");
                setStatus("Creating test document...");

                const docRef = await addDoc(collection(db, "leads"), {
                    test: true,
                    timestamp: new Date().toISOString()
                });

                console.log("2. Document created:", docRef.id);
                setStatus(`✅ SUCCESS! Document ID: ${docRef.id}`);
            } catch (err: any) {
                console.error("3. Error:", err);
                setError(err.message || String(err));
                setStatus("❌ FAILED");
            }
        };

        test();
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <h1 className="text-2xl font-bold mb-4">Firebase Connection Test</h1>
            <p className="text-lg mb-2">Status: {status}</p>
            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800 font-mono text-sm">{error}</p>
                </div>
            )}
        </div>
    );
}
