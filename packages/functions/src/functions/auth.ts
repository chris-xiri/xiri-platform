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
