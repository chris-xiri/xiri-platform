import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { sendEmail } from "../utils/emailUtils";
import { addMinutes, format } from "date-fns";
import * as logger from "firebase-functions/logger";

/**
 * Sends calendar invites when a vendor books an onboarding call
 * (status → onboarding_scheduled AND onboardingCallTime is set).
 * Sends to both the vendor and chris@xiri.ai.
 */
export const sendVendorBookingConfirmation = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: ["RESEND_API_KEY"],
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when onboardingCallTime is newly set
    const hadCallTime = !!before.onboardingCallTime;
    const hasCallTime = !!after.onboardingCallTime;
    if (hadCallTime || !hasCallTime) return;

    const vendorId = event.params.vendorId;
    const businessName = after.businessName || "Contractor";
    const email = after.email;
    const phone = after.phone || "N/A";
    const callTimeStr = after.onboardingCallTime; // ISO string

    logger.info(`Vendor ${vendorId} (${businessName}) booked onboarding call at ${callTimeStr}`);

    const startTime = new Date(callTimeStr);
    const duration = 30; // 30-minute onboarding call
    const endTime = addMinutes(startTime, duration);

    // Generate ICS
    const icsContent = generateICS({
        start: startTime,
        end: endTime,
        summary: `XIRI Onboarding Call: ${businessName}`,
        description: `Onboarding call with ${businessName}.\n\nContact: ${email}\nPhone: ${phone}\n\nPower to the Facilities!`,
        location: "Phone Call",
        organizer: { name: "XIRI Facility Solutions", email: "onboarding@xiri.ai" },
    });

    // ─── Email to Vendor ───
    if (email) {
        const vendorHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">You're Booked! 📅</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <p>Hi <strong>${businessName}</strong>,</p>
                <p>Your onboarding call has been confirmed:</p>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #0c4a6e;">
                        ${format(startTime, "EEEE, MMMM do")}
                    </p>
                    <p style="margin: 8px 0 0; font-size: 16px; color: #334155;">
                        ${format(startTime, "h:mm a")} • ${duration} minutes
                    </p>
                </div>
                <p style="font-size: 14px; color: #64748b;">A calendar invitation is attached to this email. We look forward to speaking with you!</p>
                <p style="margin-top: 24px;">Best regards,<br/><strong>XIRI Facility Solutions Team</strong></p>
            </div>
        </div>`;

        const vendorSent = await sendEmail(email, `📅 Onboarding Call Confirmed — ${format(startTime, "EEEE, MMMM do 'at' h:mm a")}`, vendorHtml, [
            { filename: "xiri-onboarding-call.ics", content: icsContent },
        ]);

        if (vendorSent) {
            logger.info(`Calendar invite sent to vendor ${email}`);
        } else {
            logger.error(`Failed to send calendar invite to vendor ${email}`);
        }
    }

    // ─── Email to Chris ───
    const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0c4a6e;">📅 Onboarding Call Booked</h2>
        <p><strong>${businessName}</strong> has booked an onboarding call.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>When:</strong> ${format(startTime, "EEEE, MMMM do 'at' h:mm a")}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${email || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone}</p>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">Vendor ID: ${vendorId}</p>
    </div>`;

    const adminSent = await sendEmail("chris@xiri.ai", `📅 Onboarding Call: ${businessName} — ${format(startTime, "MMM do 'at' h:mm a")}`, adminHtml, [
        { filename: "xiri-onboarding-call.ics", content: icsContent },
    ]);

    if (adminSent) {
        logger.info("Calendar invite sent to chris@xiri.ai");
    } else {
        logger.error("Failed to send calendar invite to chris@xiri.ai");
    }
});

// ─── ICS Generator ───
function generateICS(event: {
    start: Date;
    end: Date;
    summary: string;
    description: string;
    location: string;
    organizer: { name: string; email: string };
}) {
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//XIRI//Facility Solutions//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@xiri.ai
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.summary}
DESCRIPTION:${event.description.replace(/\n/g, "\\n")}
LOCATION:${event.location}
ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email}
ATTENDEE;CN=${event.organizer.name};RSVP=TRUE:mailto:${event.organizer.email}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}
