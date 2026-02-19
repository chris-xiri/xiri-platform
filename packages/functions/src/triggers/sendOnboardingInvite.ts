import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendEmail } from "../utils/emailUtils";
import { addMinutes, format } from "date-fns";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const ADMIN_EMAIL = "chris@xiri.ai";

/**
 * Sends a calendar invite (.ics) to both the vendor and admin
 * when a vendor's status changes to 'onboarding_scheduled'
 * and they have an onboardingCallTime set.
 */
export const sendOnboardingInvite = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: ["RESEND_API_KEY"],
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when status changes TO 'onboarding_scheduled'
    if (before.status === after.status) return;
    if (after.status !== 'onboarding_scheduled') return;

    // Must have a call time and email
    const callTime = after.onboardingCallTime;
    const vendorEmail = after.email;
    const businessName = after.businessName || 'Vendor';
    const contactName = after.contactName || businessName;
    const vendorId = event.params.vendorId;

    if (!callTime) {
        logger.warn(`Vendor ${vendorId} moved to onboarding_scheduled but no onboardingCallTime set.`);
        return;
    }

    if (!vendorEmail) {
        logger.warn(`Vendor ${vendorId} has no email. Skipping invite.`);
        return;
    }

    logger.info(`Sending onboarding invite for vendor ${vendorId} (${businessName}) at ${callTime}`);

    const startTime = new Date(callTime);
    const duration = 30; // 30-minute call
    const endTime = addMinutes(startTime, duration);

    // Generate ICS
    const icsContent = generateICS({
        start: startTime,
        end: endTime,
        summary: `Xiri Onboarding Call: ${businessName}`,
        description: `Onboarding call with ${contactName} from ${businessName}.\n\nWe'll cover:\n- Service capabilities & coverage areas\n- Insurance & compliance verification\n- Account setup & next steps\n\nPower to the Facilities!`,
        location: 'Phone Call',
        organizer: { name: "Xiri Facility Solutions", email: "onboarding@xiri.ai" },
        attendees: [
            { name: contactName, email: vendorEmail },
            { name: "Xiri Team", email: ADMIN_EMAIL }
        ]
    });

    const formattedTime = format(startTime, "EEEE, MMMM do 'at' h:mm a");

    const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0ea5e9;">Onboarding Call Confirmed!</h1>
        <p>Hi ${contactName},</p>
        <p>Your onboarding call with Xiri Facility Solutions has been scheduled:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">
                ${formattedTime}
            </p>
            <p style="margin: 5px 0 0; color: #6b7280;">Duration: ${duration} minutes • Phone Call</p>
        </div>
        <p><strong>What to expect:</strong></p>
        <ul>
            <li>Quick review of your service capabilities</li>
            <li>Insurance & compliance verification</li>
            <li>Account setup and next steps</li>
        </ul>
        <p>A calendar invitation has been attached to this email.</p>
        <p>Best,<br/>The Xiri Team</p>
    </div>
    `;

    const subject = `Confirmed: Xiri Onboarding Call — ${formattedTime}`;

    // Send to vendor
    const vendorSent = await sendEmail(vendorEmail, subject, htmlBody, [
        { filename: 'onboarding-call.ics', content: icsContent }
    ]);

    // Send to admin
    const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0ea5e9;">New Onboarding Call Booked</h1>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${businessName}</p>
            <p style="margin: 5px 0 0; color: #6b7280;">${formattedTime} • ${duration} min</p>
            <p style="margin: 5px 0 0; color: #6b7280;">Contact: ${contactName} (${vendorEmail})</p>
        </div>
        <p><a href="https://app.xiri.ai/supply/crm/${vendorId}" style="color: #0ea5e9;">View in CRM →</a></p>
    </div>
    `;

    await sendEmail(ADMIN_EMAIL, `Onboarding Call: ${businessName} — ${formattedTime}`, adminHtml, [
        { filename: 'onboarding-call.ics', content: icsContent }
    ]);

    // Log activity
    await db.collection("vendor_activities").add({
        vendorId,
        type: "ONBOARDING_CALL_SCHEDULED",
        description: `Onboarding call scheduled for ${formattedTime}`,
        createdAt: new Date(),
        metadata: {
            callTime,
            vendorEmail,
            adminEmail: ADMIN_EMAIL,
            emailSent: vendorSent
        }
    });

    logger.info(`Onboarding invite sent for vendor ${vendorId}. Vendor: ${vendorSent ? '✅' : '❌'}`);
});


// Helper: Generate ICS String with attendees
function generateICS(event: {
    start: Date;
    end: Date;
    summary: string;
    description: string;
    location: string;
    organizer: { name: string; email: string };
    attendees?: Array<{ name: string; email: string }>;
}) {
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let attendeeLines = '';
    if (event.attendees) {
        attendeeLines = event.attendees
            .map(a => `ATTENDEE;CN=${a.name};RSVP=TRUE:mailto:${a.email}`)
            .join('\r\n');
    }

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Xiri//Facility Solutions//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:onboarding-${Date.now()}@xiri.ai
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.summary}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
LOCATION:${event.location}
ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email}
${attendeeLines}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}
