import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { buildSimpleFooter, buildEmailHeader, buildEmailSignature } from "../utils/emailUtils";

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
 * Creates the Auth account with a temp password, writes the Firestore user doc,
 * and sends an invite email via Resend with login credentials.
 */
export const adminCreateUser = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["RESEND_API_KEY"],
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

    // Generate a secure temporary password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = 'Xiri-' + Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '!';

    try {
        // 1. Create Firebase Auth user WITH password
        const userRecord = await getAuth().createUser({
            email,
            displayName,
            password: tempPassword,
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

        // 3. Send invite email via Resend
        let emailSent = false;
        try {
            const { Resend } = await import('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: 'XIRI Facility Solutions <noreply@xiri.ai>',
                replyTo: 'chris@xiri.ai',
                to: email,
                subject: `Welcome to XIRI Dashboard — Your login credentials`,
                html: `
                    ${buildEmailHeader()}
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">Welcome to XIRI</h1>
                            <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Your dashboard account has been created</p>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                            <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">Hi <strong>${displayName}</strong>,</p>
                            <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">Here are your login credentials:</p>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-size: 13px; color: #94a3b8; width: 100px;">Dashboard</td>
                                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600;"><a href="https://app.xiri.ai" style="color: #2563eb; text-decoration: none;">app.xiri.ai</a></td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-size: 13px; color: #94a3b8;">Email</td>
                                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${email}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-size: 13px; color: #94a3b8;">Password</td>
                                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #0f172a; font-family: 'Courier New', monospace;">${tempPassword}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-size: 13px; color: #94a3b8;">Role</td>
                                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${roles.join(', ')}</td>
                                </tr>
                            </table>
                        </div>
                        <div style="text-align: center; margin-bottom: 24px;">
                            <a href="https://app.xiri.ai" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">Log In Now →</a>
                        </div>
                        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Please change your password after first login via Settings.</p>

                        ${buildEmailSignature()}
                        ${buildSimpleFooter()}
                    </div>
                `,
            });
            emailSent = true;
            console.log(`✅ Invite email sent to ${email}`);
        } catch (emailErr) {
            console.error("Failed to send invite email:", emailErr);
            // Don't throw — user was still created, just email failed
        }

        return {
            success: true,
            uid,
            tempPassword,
            emailSent,
            message: emailSent
                ? `User ${email} created and invite email sent with login credentials.`
                : `User ${email} created. Email failed — share the temp password manually.`,
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
