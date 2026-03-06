import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";

/**
 * Admin-only: update a user's email and/or password in Firebase Auth
 * Called from admin user management when editing a user
 */
export const adminUpdateAuthUser = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    // Verify caller is admin
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerRoles = callerDoc.data()?.roles || [];
    if (!callerRoles.includes("admin")) throw new HttpsError("permission-denied", "Admin only");

    const { uid, email, password, displayName } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required");

    const updatePayload: Record<string, string> = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;
    if (displayName) updatePayload.displayName = displayName;

    if (Object.keys(updatePayload).length === 0) {
        throw new HttpsError("invalid-argument", "Nothing to update");
    }

    try {
        await getAuth().updateUser(uid, updatePayload);
        return { success: true, message: `Auth updated for ${uid}` };
    } catch (error: any) {
        console.error("adminUpdateAuthUser error:", error);
        throw new HttpsError("internal", error.message || "Failed to update Auth user");
    }
});

/**
 * Admin-only: create a new user in Firebase Auth + Firestore
 * Creates the Auth account, writes the Firestore user doc, and generates
 * a password reset link so the user can set their own password.
 */
export const adminCreateUser = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    // Verify caller is admin
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerRoles = callerDoc.data()?.roles || [];
    if (!callerRoles.includes("admin")) throw new HttpsError("permission-denied", "Admin only");

    const { email, displayName, roles } = request.data;
    if (!email) throw new HttpsError("invalid-argument", "email is required");
    if (!displayName) throw new HttpsError("invalid-argument", "displayName is required");
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
        throw new HttpsError("invalid-argument", "At least one role is required");
    }

    try {
        // 1. Create Firebase Auth user (no password — they'll set via reset link)
        const userRecord = await getAuth().createUser({
            email,
            displayName,
            disabled: false,
        });
        const uid = userRecord.uid;

        // 2. Create Firestore user doc
        await db.collection("users").doc(uid).set({
            uid,
            email,
            displayName,
            roles,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null,
        });

        // 3. Generate password reset link
        const resetLink = await getAuth().generatePasswordResetLink(email);

        return {
            success: true,
            uid,
            resetLink,
            message: `User ${email} created. Share the password reset link so they can set their password.`,
        };
    } catch (error: any) {
        console.error("adminCreateUser error:", error);
        if (error.code === "auth/email-already-exists") {
            throw new HttpsError("already-exists", "A user with this email already exists");
        }
        throw new HttpsError("internal", error.message || "Failed to create user");
    }
});

/**
 * Self-service: any authenticated user can change their own password
 */
export const changeMyPassword = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { newPassword } = request.data;
    if (!newPassword || newPassword.length < 6) {
        throw new HttpsError("invalid-argument", "Password must be at least 6 characters");
    }

    try {
        await getAuth().updateUser(request.auth.uid, { password: newPassword });
        return { success: true, message: "Password updated" };
    } catch (error: any) {
        console.error("changeMyPassword error:", error);
        throw new HttpsError("internal", error.message || "Failed to change password");
    }
});
