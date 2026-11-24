import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db, admin } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { cancelLeadTasks } from "../utils/queueUtils";
import { sendLeadChatNotification } from "../utils/leadChatWebhook";
import { normalizeAttribution, formatAttributionSummary } from "../utils/attribution";
import { buildAuditConfirmationEmail, buildInternalNotificationEmail } from "../triggers/onAuditSubmitted";

function cleanString(value: unknown, maxLen = 500): string {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLen);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
    const cleaned = fullName.trim();
    if (!cleaned) return { firstName: "", lastName: "" };
    const parts = cleaned.split(/\s+/);
    return {
        firstName: parts[0] || "",
        lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
    };
}

/**
 * Public Audit Wizard — Step 0 initialization.
 * Creates the canonical CRM `companies/{id}` (+ `contacts` if email provided)
 * and `leads/{id}` (which triggers `onAuditSubmitted`) via Admin SDK so
 * Firestore rules on `leads`/`companies`/`contacts` stay strictly authenticated-only.
 */
export const createAuditLead = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (request) => {
    const data = request.data || {};
    const zip = cleanString(data.zip, 20);
    const email = cleanString(data.email, 254).toLowerCase();
    const service = cleanString(data.service, 100) || "general";
    const formSource = cleanString(data.source, 150) || "direct";
    const facilityType = cleanString(data.facilityType, 120);
    const businessName = cleanString(data.businessName, 200);
    const address = cleanString(data.address, 300);
    const squareFootageRaw = data.squareFootage;
    const squareFootage = squareFootageRaw !== undefined && squareFootageRaw !== null && squareFootageRaw !== ""
        ? Number(squareFootageRaw)
        : null;
    const validSqft = typeof squareFootage === "number" && Number.isFinite(squareFootage) && squareFootage > 0
        ? squareFootage
        : null;
    const serviceWindow = cleanString(data.serviceWindow, 100);
    const transitionDate = cleanString(data.transitionDate, 100);
    const scopeBrief = cleanString(data.scopeBrief, 2000);
    const rawAttr = (data.attribution && typeof data.attribution === "object") ? data.attribution : {};

    if (!zip && !address) {
        throw new HttpsError("invalid-argument", "ZIP code or facility address is required.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const companyRef = db.collection("companies").doc();
    const leadId = companyRef.id;
    const attribution = normalizeAttribution(rawAttr, formSource, leadId);

    const batch = db.batch();

    // 1. Canonical CRM Company
    batch.set(companyRef, {
        businessName: businessName || (email ? email.split("@")[1] || "Audit Prospect" : "Audit Prospect"),
        status: "new",
        source: "audit_wizard",
        zipCode: zip || null,
        zip: zip || null,
        email: email || null,
        serviceInterest: service,
        facilityType: facilityType || null,
        address: address || null,
        squareFootage: validSqft,
        serviceWindow: serviceWindow || null,
        transitionDate: transitionDate || null,
        scopeBrief: scopeBrief || null,
        attribution,
        wizardStep: 1,
        createdAt: now,
        updatedAt: now,
    });

    // 2. Primary CRM Contact (if email provided)
    let contactId: string | null = null;
    if (email) {
        const contactRef = db.collection("contacts").doc();
        contactId = contactRef.id;
        batch.set(contactRef, {
            name: businessName || email.split("@")[0] || "Facility Contact",
            firstName: "",
            lastName: "",
            email,
            phone: null,
            role: "Facility Manager",
            title: "Facility Manager",
            companyId: leadId,
            companyName: businessName || "Audit Prospect",
            isPrimary: true,
            lifecycleStatus: "active",
            lifecycleReason: null,
            reviewReasons: [],
            emailStatus: "unknown",
            suppressionReason: null,
            validationSource: "audit_wizard",
            duplicateOfContactId: null,
            unsubscribed: false,
            source: "audit_wizard",
            status: "new",
            stage: "lead",
            createdAt: now,
            updatedAt: now,
        });
    }

    // 3. Matching `leads/{leadId}` document (triggers `onAuditSubmitted` confirmation + internal alert)
    batch.set(db.collection("leads").doc(leadId), {
        status: "new",
        source: "audit_wizard",
        zipCode: zip || null,
        email: email || null,
        serviceInterest: service,
        facilityType: facilityType || null,
        businessName: businessName || null,
        address: address || null,
        squareFootage: validSqft,
        serviceWindow: serviceWindow || null,
        transitionDate: transitionDate || null,
        scopeBrief: scopeBrief || null,
        attribution,
        wizardStep: 1,
        ...(contactId ? { primaryContactId: contactId } : {}),
        createdAt: now,
        updatedAt: now,
    });

    await batch.commit();

    // If this email already exists in our outbound SDR funnel, halt their cold sequence immediately
    if (email) {
        try {
            const existingContacts = await db.collection("contacts").where("email", "==", email).get();
            for (const cDoc of existingContacts.docs) {
                const existingCompanyId = cDoc.data()?.companyId;
                if (existingCompanyId && existingCompanyId !== leadId) {
                    await cancelLeadTasks(db, existingCompanyId);
                    await db.collection("companies").doc(existingCompanyId).set({
                        status: "qualified",
                        outreachStatus: "CONVERTED_AUDIT",
                        updatedAt: new Date(),
                    }, { merge: true });
                }
            }
        } catch (haltErr) {
            logger.warn("[AuditWizard] Could not halt matching cold funnel tasks:", haltErr);
        }
    }

    logger.info(`[AuditWizard] Created audit lead ${leadId} (zip=${zip || "n/a"}, source=${formSource})`);

    return { leadId };
});

/**
 * Public Audit Wizard — Load safe wizard state for `/audit/[id]`.
 * Returns ONLY non-sensitive wizard progress fields so CRM data stays protected.
 */
export const getAuditLead = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 20,
    memory: "256MiB",
}, async (request) => {
    const leadId = cleanString(request.data?.leadId, 128);
    if (!leadId) {
        throw new HttpsError("invalid-argument", "Missing leadId.");
    }

    const companySnap = await db.collection("companies").doc(leadId).get();
    const leadSnap = companySnap.exists ? companySnap : await db.collection("leads").doc(leadId).get();

    if (!leadSnap.exists) {
        return { exists: false };
    }

    const data = leadSnap.data() || {};
    // Only allow loading documents created through the public audit wizard
    const isAuditWizard = data.source === "audit_wizard" || typeof data.wizardStep === "number";
    if (!isAuditWizard) {
        return { exists: false };
    }

    return {
        exists: true,
        lead: {
            serviceInterest: data.serviceInterest || null,
            services: Array.isArray(data.services) ? data.services : null,
            facilityType: data.facilityType || "",
            businessName: data.businessName && data.businessName !== "Audit Prospect" ? data.businessName : "",
            squareFootage: data.squareFootage ?? null,
            address: data.address || "",
            contactName: data.contactName || data.name || "",
            contactPhone: data.contactPhone || data.phone || "",
            contactRole: data.contactRole || data.role || "Facility Manager",
            wizardStep: typeof data.wizardStep === "number" ? data.wizardStep : 1,
        },
    };
});

/**
 * Public Audit Wizard — Save step progress for `/audit/[id]`.
 * Only updates an explicit allowlist of wizard fields on `companies`, `leads`, and primary `contacts`.
 */
export const updateAuditLead = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 20,
    memory: "256MiB",
}, async (request) => {
    const leadId = cleanString(request.data?.leadId, 128);
    const rawUpdates = request.data?.updates;
    const rawWizardStep = request.data?.wizardStep;

    if (!leadId) {
        throw new HttpsError("invalid-argument", "Missing leadId.");
    }
    if (!rawUpdates || typeof rawUpdates !== "object") {
        throw new HttpsError("invalid-argument", "Missing updates.");
    }

    const companyRef = db.collection("companies").doc(leadId);
    const leadRef = db.collection("leads").doc(leadId);
    const [companySnap, leadSnap] = await Promise.all([companyRef.get(), leadRef.get()]);

    const existingData = companySnap.exists ? companySnap.data() : leadSnap.data();
    if (!existingData) {
        throw new HttpsError("not-found", "Audit record not found.");
    }
    if (existingData.source !== "audit_wizard" && typeof existingData.wizardStep !== "number") {
        throw new HttpsError("permission-denied", "Not an audit wizard record.");
    }

    const sanitized: Record<string, any> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (Array.isArray(rawUpdates.services)) {
        sanitized.services = rawUpdates.services
            .filter((s: unknown) => typeof s === "string")
            .map((s: string) => s.trim().slice(0, 60))
            .slice(0, 20);
    }
    if (typeof rawUpdates.facilityType === "string") {
        sanitized.facilityType = cleanString(rawUpdates.facilityType, 120);
    }
    if (typeof rawUpdates.businessName === "string") {
        sanitized.businessName = cleanString(rawUpdates.businessName, 200);
    }
    if (typeof rawUpdates.address === "string") {
        sanitized.address = cleanString(rawUpdates.address, 300);
    }
    if (rawUpdates.squareFootage !== undefined) {
        const num = rawUpdates.squareFootage === null || rawUpdates.squareFootage === ""
            ? null
            : Number(rawUpdates.squareFootage);
        sanitized.squareFootage = typeof num === "number" && Number.isFinite(num) && num > 0 ? num : null;
    }

    const contactName = cleanString(rawUpdates.contactName ?? rawUpdates.name, 150);
    const contactPhone = cleanString(rawUpdates.contactPhone ?? rawUpdates.phone, 40);
    const contactRole = cleanString(rawUpdates.contactRole ?? rawUpdates.role, 100);

    if (contactName) {
        sanitized.name = contactName;
        sanitized.contactName = contactName;
    }
    if (contactPhone) {
        sanitized.phone = contactPhone;
        sanitized.contactPhone = contactPhone;
    }
    if (contactRole) {
        sanitized.role = contactRole;
        sanitized.contactRole = contactRole;
    }

    if (typeof rawWizardStep === "number" && Number.isFinite(rawWizardStep) && rawWizardStep >= 1 && rawWizardStep <= 10) {
        sanitized.wizardStep = Math.floor(rawWizardStep);
    }

    const batch = db.batch();
    if (companySnap.exists) {
        batch.set(companyRef, sanitized, { merge: true });
    }
    if (leadSnap.exists) {
        batch.set(leadRef, sanitized, { merge: true });
    }

    // Keep primary CRM contact in sync when businessName or contact details are filled
    if (companySnap.exists && (sanitized.businessName || contactName || contactPhone || contactRole)) {
        const contactsSnap = await db.collection("contacts")
            .where("companyId", "==", leadId)
            .limit(1)
            .get();

        const contactUpdates: Record<string, any> = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (sanitized.businessName) contactUpdates.companyName = sanitized.businessName;
        if (contactName) {
            const { firstName, lastName } = splitName(contactName);
            contactUpdates.name = contactName;
            contactUpdates.firstName = firstName;
            contactUpdates.lastName = lastName;
        }
        if (contactPhone) contactUpdates.phone = contactPhone;
        if (contactRole) {
            contactUpdates.role = contactRole;
            contactUpdates.title = contactRole;
        }

        if (!contactsSnap.empty) {
            batch.set(contactsSnap.docs[0].ref, contactUpdates, { merge: true });
        } else if (contactName || contactPhone) {
            const { firstName, lastName } = splitName(contactName);
            batch.set(db.collection("contacts").doc(), {
                name: contactName || sanitized.businessName || existingData.businessName || "Facility Contact",
                firstName,
                lastName,
                email: existingData.email || "",
                phone: contactPhone || null,
                role: contactRole || "Facility Manager",
                title: contactRole || "Facility Manager",
                companyId: leadId,
                companyName: sanitized.businessName || existingData.businessName || "Audit Prospect",
                isPrimary: true,
                lifecycleStatus: "active",
                lifecycleReason: null,
                reviewReasons: [],
                emailStatus: existingData.email ? "unknown" : "invalid",
                suppressionReason: null,
                validationSource: "audit_wizard",
                duplicateOfContactId: null,
                unsubscribed: false,
                source: "audit_wizard",
                status: "new",
                stage: "lead",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }

    await batch.commit();

    // When the visitor completes their contact details step (step 3 -> 4), send the full internal &
    // confirmation emails (deferred from Step 0) + post enriched summary to Leads Google Chat.
    if (contactName || contactPhone) {
        const mergedData = { ...existingData, ...sanitized };
        const mergedBiz = (sanitized.businessName || existingData.businessName || "").replace(/^Audit Prospect$/i, "") || "Your Facility";
        const mergedContactName = contactName || existingData.contactName || existingData.name || "";
        const mergedEmail = existingData.email || existingData.contactEmail || "";
        const mergedAddress = sanitized.address || existingData.address || "";
        const mergedLocation = mergedAddress || existingData.zipCode || "Not specified";
        const mergedServices = Array.isArray(mergedData.services)
            ? mergedData.services.join(", ")
            : (mergedData.serviceInterest || undefined);

        if (!existingData.auditNotificationSentAt && mergedEmail) {
            const sentTs = admin.firestore.FieldValue.serverTimestamp();
            await Promise.all([
                db.collection("mail_queue").add({
                    to: mergedEmail,
                    subject: `We received your audit request — ${mergedBiz}`,
                    templateType: "audit_confirmation",
                    templateData: {
                        html: buildAuditConfirmationEmail(mergedContactName, mergedBiz),
                    },
                    status: "pending",
                    createdAt: sentTs,
                }),
                db.collection("mail_queue").add({
                    to: "chris@xiri.ai",
                    subject: `🔔 New Audit Lead: ${mergedBiz}`,
                    templateType: "internal_notification",
                    templateData: {
                        html: buildInternalNotificationEmail(leadId, mergedContactName, mergedEmail, mergedBiz, mergedAddress, mergedData),
                    },
                    status: "pending",
                    createdAt: sentTs,
                }),
                db.collection("activity_logs").add({
                    type: "AUDIT_SUBMITTED",
                    leadId,
                    email: mergedEmail,
                    businessName: mergedBiz,
                    description: `Completed audit lead from ${mergedBiz} (${mergedContactName || mergedEmail})`,
                    createdAt: sentTs,
                }),
                companySnap.exists ? companyRef.set({ auditNotificationSentAt: sentTs }, { merge: true }) : Promise.resolve(),
                leadSnap.exists ? leadRef.set({ auditNotificationSentAt: sentTs }, { merge: true }) : Promise.resolve(),
            ]);
            logger.info(`[AuditWizard] Sent complete confirmation + internal alert email for ${leadId} (${mergedBiz})`);
        }

        await sendLeadChatNotification({
            cardId: `audit-completed-${leadId}`,
            title: "✅ Audit Wizard Details Completed",
            subtitle: `${mergedBiz} • ${mergedContactName || mergedEmail || "Lead"}`,
            fallbackText: `✅ Audit Details Completed: ${mergedBiz} — ${mergedContactName || "Contact"} (${contactPhone || mergedEmail || ""})`,
            businessName: mergedBiz,
            contactName: mergedContactName || undefined,
            contactRole: contactRole || existingData.contactRole || undefined,
            email: mergedEmail || undefined,
            phone: contactPhone || existingData.contactPhone || undefined,
            location: mergedLocation,
            facilityType: sanitized.facilityType || existingData.facilityType || undefined,
            squareFootage: sanitized.squareFootage ?? existingData.squareFootage ?? null,
            services: mergedServices,
            source: formatAttributionSummary(existingData.attribution, "audit_wizard"),
            crmUrl: `https://app.xiri.ai/sales/crm/${leadId}`,
        });
    }

    return { success: true };
});
