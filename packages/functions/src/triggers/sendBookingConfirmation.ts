import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { sendEmail } from "../utils/emailUtils";
import { addMinutes, format } from "date-fns";

const TIMEOUT_SECONDS = 300;

export const sendBookingConfirmation = onDocumentWritten({
    document: "leads/{leadId}",
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: TIMEOUT_SECONDS
}, async (event) => {
    // 1. Validate Event
    if (!event.data) return; // Deletion

    const before = event.data.before.data();
    const after = event.data.after.data();

    // 2. Check Triggers
    // - Status changed to 'new' (Completed Wizard)
    // - OR Times changed on an existing 'new' lead (Rescheduling)
    const statusChangedToNew = (before?.status !== 'new' && after?.status === 'new');
    const timesChanged = (JSON.stringify(before?.preferredAuditTimes) !== JSON.stringify(after?.preferredAuditTimes));

    // Only proceed if status is 'new' AND (it just became new OR times changed)
    const shouldSend = after?.status === 'new' && (statusChangedToNew || timesChanged);

    if (!shouldSend) return;

    // 3. Validate Data for Email
    const { email, contactName, preferredAuditTimes, meetingType, meetingDuration, businessName } = after;

    if (!email || !preferredAuditTimes || preferredAuditTimes.length === 0) {
        console.log("Missing email or times for lead", event.params.leadId);
        return;
    }

    // 4. Prepare Meeting Details
    const startTimeStr = preferredAuditTimes[0]; // ISO String
    const startTime = new Date(startTimeStr);
    const duration = meetingDuration || 60; // Default 60 mins
    const endTime = addMinutes(startTime, duration);
    const type = meetingType === 'intro' ? 'Intro Call' : 'Internal Audit';

    // 5. Generate ICS File
    const icsContent = generateICS({
        start: startTime,
        end: endTime,
        summary: `Xiri ${type}: ${businessName || 'Facility Audit'}`,
        description: `Meeting with ${contactName || 'Client'}.\n\nType: ${type}\nDuration: ${duration} mins\n\nPower to the Facilities!`,
        location: type === 'intro' ? 'Phone Call' : (after.address || after.zipCode || 'On Site'),
        organizer: { name: "Xiri Facility Solutions", email: "onboarding@xiri.ai" }
    });

    // 6. Send Email
    const subject = `Confirmed: Your Xini ${type}`;
    const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0ea5e9;">You're booked!</h1>
            <p>Hi ${contactName || 'there'},</p>
            <p>We've confirmed your <strong>${type}</strong> for:</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px; font-weight: bold;">
                    ${format(startTime, "EEEE, MMMM do 'at' h:mm a")}
                </p>
                <p style="margin: 5px 0 0; color: #6b7280;">Duration: ${duration} mins</p>
            </div>
            <p>A calendar invitation has been attached to this email.</p>
            <p>Best,<br/>The Xiri Team</p>
        </div>
    `;

    await sendEmail(email, subject, htmlBody, [
        {
            filename: 'invite.ics',
            content: icsContent,
        },
    ]);
});

// Helper: Generate ICS String
function generateICS(event: {
    start: Date;
    end: Date;
    summary: string;
    description: string;
    location: string;
    organizer: { name: string; email: string };
}) {
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Xiri//Facility Solutions//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@xiri.ai
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.summary}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
LOCATION:${event.location}
ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email}
STATUS:CONFIRMED
sequence:0
END:VEVENT
END:VCALENDAR`;
}
