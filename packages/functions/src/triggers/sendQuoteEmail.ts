import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { sendEmail } from "../utils/emailUtils";
import { v4 as uuidv4 } from "uuid";

const db = admin.firestore();

/**
 * Cloud Function: sendQuoteEmail
 * Called from the dashboard when Sales clicks "Send to Client"
 * 
 * Generates a reviewToken, updates the quote, and sends a branded email
 * with a link to the public review page.
 */
export const sendQuoteEmail = onCall({
    secrets: ["RESEND_API_KEY"],
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app",
        "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app",
        /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
        "https://xiri-facility-solutions.web.app",
        "https://xiri-facility-solutions.firebaseapp.com"
    ],
}, async (request) => {
    // Validate auth
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { quoteId, clientEmail, clientName } = request.data;

    if (!quoteId || !clientEmail) {
        throw new HttpsError("invalid-argument", "Missing quoteId or clientEmail");
    }

    // Fetch the quote
    const quoteRef = db.collection("quotes").doc(quoteId);
    const quoteSnap = await quoteRef.get();

    if (!quoteSnap.exists) {
        throw new HttpsError("not-found", "Quote not found");
    }

    const quote = quoteSnap.data()!;

    // Generate review token
    const reviewToken = uuidv4();

    // Update quote with token and email info
    await quoteRef.update({
        reviewToken,
        clientEmail,
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build the review URL
    const reviewUrl = `https://xiri.ai/quote/review/${reviewToken}`;

    // Build branded HTML email
    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const formatFrequency = (freq: string, daysOfWeek?: boolean[]) => {
        if (freq === "custom_days" && daysOfWeek) {
            const days = daysOfWeek.map((on: boolean, i: number) => on ? DAY_NAMES[i] : null).filter(Boolean);
            const monFri = [false, true, true, true, true, true, false];
            if (JSON.stringify(daysOfWeek) === JSON.stringify(monFri)) return "Mon–Fri";
            return days.join(", ") || "Custom";
        }
        const labels: Record<string, string> = { nightly: "Nightly", weekly: "Weekly", biweekly: "Bi-Weekly", monthly: "Monthly", quarterly: "Quarterly", custom_days: "Custom" };
        return labels[freq] || freq;
    };

    const lineItemRows = (quote.lineItems || []).map((item: any) =>
        `<tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.locationName}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.serviceType}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${formatFrequency(item.frequency, item.daysOfWeek)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.clientRate)}/mo</td>
        </tr>`
    ).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">XIRI</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">FACILITY SOLUTIONS</p>
            </div>

            <!-- Body -->
            <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #111827; margin: 0 0 8px; font-size: 22px;">Your Service Proposal</h2>
                <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">
                    Hi${clientName ? ` ${clientName}` : ""},<br/>
                    Thank you for considering XIRI Facility Solutions. Below is a summary of the proposed services for <strong>${quote.leadBusinessName}</strong>.
                </p>

                <!-- Service Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                        <tr style="background: #f9fafb;">
                            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Location</th>
                            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Service</th>
                            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Frequency</th>
                            <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineItemRows}
                    </tbody>
                </table>

                <!-- Total -->
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 32px;">
                    <p style="color: #6b7280; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Monthly Investment</p>
                    <p style="color: #0369a1; margin: 4px 0 0; font-size: 32px; font-weight: 700;">${formatCurrency(quote.totalMonthlyRate)}<span style="font-size: 14px; font-weight: 400; color: #6b7280;">/month</span></p>
                    <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">${quote.contractTenure}-month agreement • ${quote.paymentTerms}</p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 16px;">
                    <a href="${reviewUrl}" style="display: inline-block; background: #0369a1; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">Review & Respond</a>
                </div>
                <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 0;">
                    Click the button above to accept or request changes to this proposal.
                </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 24px 0;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    XIRI Facility Solutions • Professional Facility Management<br/>
                    <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;

    // Send the email
    const sent = await sendEmail(
        clientEmail,
        `Service Proposal for ${quote.leadBusinessName} — XIRI Facility Solutions`,
        html
    );

    if (!sent) {
        throw new HttpsError("internal", "Failed to send email");
    }

    // Log activity
    await db.collection("activity_logs").add({
        type: "QUOTE_SENT",
        quoteId,
        leadId: quote.leadId,
        clientEmail,
        sentBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, reviewToken };
});

/**
 * Cloud Function: respondToQuote
 * Called from the public review page when a client clicks Accept or Request Changes.
 * No auth required — secured by the reviewToken.
 */
export const respondToQuote = onCall({
    secrets: ["RESEND_API_KEY"],
    cors: [
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
    ],
}, async (request) => {
    const { reviewToken, action, notes } = request.data;

    if (!reviewToken || !action) {
        throw new HttpsError("invalid-argument", "Missing reviewToken or action");
    }

    if (!["accept", "request_changes"].includes(action)) {
        throw new HttpsError("invalid-argument", "Invalid action");
    }

    // Find quote by reviewToken
    const quotesSnap = await db.collection("quotes")
        .where("reviewToken", "==", reviewToken)
        .limit(1)
        .get();

    if (quotesSnap.empty) {
        throw new HttpsError("not-found", "Invalid or expired quote link");
    }

    const quoteDoc = quotesSnap.docs[0];
    const quote = quoteDoc.data();

    if (quote.status !== "sent") {
        throw new HttpsError("failed-precondition", `This quote has already been ${quote.status}`);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "accept") {
        // 1. Create Contract
        const contractRef = await db.collection("contracts").add({
            leadId: quote.leadId,
            quoteId: quoteDoc.id,
            clientBusinessName: quote.leadBusinessName,
            clientAddress: "",
            signerName: "",
            signerTitle: "",
            totalMonthlyRate: quote.totalMonthlyRate,
            contractTenure: quote.contractTenure,
            startDate: now,
            endDate: new Date(Date.now() + (quote.contractTenure * 30 * 24 * 60 * 60 * 1000)),
            paymentTerms: quote.paymentTerms,
            exitClause: quote.exitClause || "30-day written notice",
            status: "active",
            createdBy: "client_accepted",
            createdAt: now,
            updatedAt: now,
        });

        // 2. Create Work Orders
        for (const item of (quote.lineItems || [])) {
            await db.collection("work_orders").add({
                leadId: quote.leadId,
                contractId: contractRef.id,
                quoteLineItemId: item.id,
                locationId: item.locationId,
                locationName: item.locationName,
                serviceType: item.serviceType,
                scopeTemplateId: item.scopeTemplateId || null,
                tasks: [],
                vendorId: null,
                vendorRate: null,
                vendorHistory: [],
                schedule: {
                    daysOfWeek: [false, true, true, true, true, true, false],
                    startTime: "21:00",
                    frequency: item.frequency,
                },
                qrCodeSecret: uuidv4(),
                clientRate: item.clientRate,
                margin: null,
                status: "pending_assignment",
                assignedFsmId: quote.assignedFsmId || null,
                assignedBy: null,
                notes: "",
                createdAt: now,
                updatedAt: now,
            });
        }

        // 3. Update Quote
        await quoteDoc.ref.update({
            status: "accepted",
            acceptedAt: now,
            clientResponseAt: now,
            clientResponseNotes: notes || null,
            updatedAt: now,
        });

        // 4. Update Lead
        await db.collection("leads").doc(quote.leadId).update({
            status: "won",
            contractId: contractRef.id,
            wonAt: now,
        });

        // 5. Send confirmation email to client
        if (quote.clientEmail) {
            await sendEmail(
                quote.clientEmail,
                `Proposal Accepted — Welcome to XIRI Facility Solutions`,
                `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #0369a1;">Thank you!</h2>
                    <p>Your service agreement for <strong>${quote.leadBusinessName}</strong> has been confirmed.</p>
                    <p>Your dedicated Facility Solutions Manager will be in touch shortly to coordinate getting started.</p>
                    <p style="color: #6b7280; font-size: 13px;">— XIRI Facility Solutions</p>
                </div>`
            );
        }

        // 6. Log
        await db.collection("activity_logs").add({
            type: "QUOTE_ACCEPTED_BY_CLIENT",
            quoteId: quoteDoc.id,
            leadId: quote.leadId,
            contractId: contractRef.id,
            clientEmail: quote.clientEmail,
            createdAt: now,
        });

        return { success: true, action: "accepted" };

    } else {
        // Request changes
        await quoteDoc.ref.update({
            clientResponseAt: now,
            clientResponseNotes: notes || "Client requested changes",
            updatedAt: now,
        });

        // Log
        await db.collection("activity_logs").add({
            type: "QUOTE_CHANGES_REQUESTED",
            quoteId: quoteDoc.id,
            leadId: quote.leadId,
            clientEmail: quote.clientEmail,
            notes: notes || "",
            createdAt: now,
        });

        return { success: true, action: "changes_requested" };
    }
});
