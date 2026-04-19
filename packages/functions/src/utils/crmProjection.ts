import * as admin from "firebase-admin";
import { db } from "./firebase";
import { resolveOperationalCompany } from "./companyResolver";
import type {
    ContactEmailStatus,
    ContactLifecycleStatus,
    ContactSuppressionReason,
    CrmCompanyRow,
    CrmContactRow,
    LeadStatus,
} from "@xiri/shared";

const CONTACTED_OUTREACH_STATUSES = new Set([
    "PENDING",
    "IN_PROGRESS",
    "SENT",
    "COMPLETED",
    "FAILED",
    "BOUNCED",
    "SPAM_COMPLAINT",
    "NEEDS_MANUAL",
    "UNSUBSCRIBED",
]);

const CONTACTED_EMAIL_EVENTS = new Set([
    "delivered",
    "opened",
    "clicked",
    "bounced",
    "spam",
]);

const ACTIVE_SEQUENCE_STATUSES = new Set([
    "active",
    "in_progress",
    "pending",
    "PENDING",
    "IN_PROGRESS",
]);

function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function toLower(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

function compactJoin(parts: Array<string | undefined | null>, separator = " "): string {
    return parts.map((part) => normalizeString(part)).filter(Boolean).join(separator);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
    const cleaned = normalizeString(fullName);
    if (!cleaned) return { firstName: "", lastName: "" };
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function getContactName(contact: FirebaseFirestore.DocumentData): { firstName: string; lastName: string; fullName: string } {
    const firstName = normalizeString(contact.firstName);
    const lastName = normalizeString(contact.lastName);
    const combined = compactJoin([firstName, lastName]);
    if (combined) {
        return { firstName, lastName, fullName: combined };
    }

    const legacyName = normalizeString(contact.name);
    if (legacyName) {
        const parsed = splitName(legacyName);
        return { firstName: parsed.firstName, lastName: parsed.lastName, fullName: legacyName };
    }

    return { firstName: "", lastName: "", fullName: "" };
}

function getContactLifecycle(contact: FirebaseFirestore.DocumentData): ContactLifecycleStatus {
    if (contact.lifecycleStatus) return contact.lifecycleStatus as ContactLifecycleStatus;
    if (contact.unsubscribed) return "suppressed";
    return "active";
}

function getContactSuppressionReason(contact: FirebaseFirestore.DocumentData): ContactSuppressionReason {
    if (contact.suppressionReason) return contact.suppressionReason as ContactSuppressionReason;
    if (contact.unsubscribeReason) return contact.unsubscribeReason as ContactSuppressionReason;
    if (contact.lifecycleStatus === "suppressed" || contact.unsubscribed) {
        return (contact.lifecycleReason || "unsubscribe") as ContactSuppressionReason;
    }
    return null;
}

function getEmailStatus(contact: FirebaseFirestore.DocumentData): ContactEmailStatus {
    if (contact.emailStatus) return contact.emailStatus as ContactEmailStatus;
    const lastEvent = normalizeString(contact.emailEngagement?.lastEvent).toLowerCase();
    if (lastEvent === "bounced") return "bounced";
    if (lastEvent === "spam") return "spam";
    if (["delivered", "opened", "clicked"].includes(lastEvent)) return "deliverable";
    if (!normalizeString(contact.email)) return "invalid";
    return "unknown";
}

function hasActiveSequence(contact: FirebaseFirestore.DocumentData): boolean {
    const history = contact.sequenceHistory || {};
    return Object.values(history).some((entry: any) => ACTIVE_SEQUENCE_STATUSES.has(entry?.status || ""));
}

function deriveCompanyStage(company: FirebaseFirestore.DocumentData | null | undefined, contact: FirebaseFirestore.DocumentData): LeadStatus {
    const storedStatus = normalizeString(company?.status || "new") as LeadStatus;
    if (storedStatus && storedStatus !== "new") return storedStatus;

    const outreachStatus = normalizeString(company?.outreachStatus);
    const companyEvent = normalizeString(company?.emailEngagement?.lastEvent).toLowerCase();
    const contactEvent = normalizeString(contact?.emailEngagement?.lastEvent).toLowerCase();

    if (
        (outreachStatus && CONTACTED_OUTREACH_STATUSES.has(outreachStatus)) ||
        (companyEvent && CONTACTED_EMAIL_EVENTS.has(companyEvent)) ||
        (contactEvent && CONTACTED_EMAIL_EVENTS.has(contactEvent)) ||
        hasActiveSequence(contact)
    ) {
        return "contacted";
    }

    return "new";
}

function buildLocationText(company: FirebaseFirestore.DocumentData | null | undefined): string {
    const exact = compactJoin([
        company?.address,
        compactJoin([company?.city, company?.state], ", "),
        company?.zip,
    ], " ");
    return exact || compactJoin([company?.address, company?.city, company?.state, company?.zip], ", ");
}

function buildSearchText(parts: Array<string | undefined | null>): string {
    return parts
        .map((part) => toLower(part))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function getContactRole(contact: FirebaseFirestore.DocumentData): string | undefined {
    return normalizeString(contact.role || contact.title) || undefined;
}

function isDeliverableStatus(status: ContactEmailStatus): boolean {
    return status === "deliverable" || status === "unknown" || status === "risky";
}

function isSequenceEligible(contact: FirebaseFirestore.DocumentData): boolean {
    const lifecycle = getContactLifecycle(contact);
    const emailStatus = getEmailStatus(contact);
    const suppressionReason = getContactSuppressionReason(contact);
    if (!normalizeString(contact.email)) return false;
    if (contact.duplicateOfContactId) return false;
    if (lifecycle !== "active") return false;
    if (!isDeliverableStatus(emailStatus)) return false;
    if (suppressionReason) return false;
    if (contact.unsubscribed) return false;
    return true;
}

function scorePreferredContact(contact: FirebaseFirestore.DocumentData): number {
    let score = 0;
    const lifecycle = getContactLifecycle(contact);
    const emailStatus = getEmailStatus(contact);
    const role = toLower(getContactRole(contact));
    const email = toLower(contact.email);

    if (contact.isPrimary) score += 120;
    if (isSequenceEligible(contact)) score += 100;
    if (lifecycle === "active") score += 40;
    if (emailStatus === "deliverable") score += 40;
    if (emailStatus === "unknown") score += 20;
    if (emailStatus === "risky") score += 10;
    if (contact.emailEngagement?.lastEvent === "clicked") score += 25;
    if (contact.emailEngagement?.lastEvent === "opened") score += 15;

    if (role.includes("facilit")) score += 30;
    if (role.includes("operation")) score += 30;
    if (role.includes("office manager")) score += 25;
    if (role.includes("practice manager")) score += 25;
    if (role.includes("general manager")) score += 25;
    if (role.includes("administrator")) score += 20;

    if (email.match(/^(info|contact|hello|office|admin|sales|team|service|services|marketing|support)@/i)) {
        score -= 20;
    }
    if (lifecycle === "suppressed" || lifecycle === "duplicate") score -= 80;
    if (emailStatus === "bounced" || emailStatus === "spam" || emailStatus === "invalid") score -= 120;

    return score;
}

function mapContactRow(contactId: string, contact: FirebaseFirestore.DocumentData, company: FirebaseFirestore.DocumentData | null | undefined): CrmContactRow {
    const { firstName, lastName, fullName } = getContactName(contact);
    const lifecycleStatus = getContactLifecycle(contact);
    const emailStatus = getEmailStatus(contact);
    const suppressionReason = getContactSuppressionReason(contact);
    const locationText = buildLocationText(company);
    const companyStage = deriveCompanyStage(company, contact);
    const contactName = fullName || normalizeString(contact.companyName) || normalizeString(company?.businessName);
    const lastEngagementEvent = normalizeString(contact.emailEngagement?.lastEvent) || undefined;
    const lastEngagementAt = contact.emailEngagement?.lastEventAt || undefined;

    return {
        contactId,
        companyId: normalizeString(contact.companyId),
        contactName,
        firstName,
        lastName,
        email: normalizeString(contact.email),
        phone: normalizeString(contact.phone) || undefined,
        role: getContactRole(contact),
        companyName: normalizeString(contact.companyName || company?.businessName) || "Unknown",
        facilityType: normalizeString(company?.facilityType) || undefined,
        leadType: company?.leadType,
        locationText: locationText || undefined,
        address: normalizeString(company?.address) || undefined,
        city: normalizeString(company?.city) || undefined,
        state: normalizeString(company?.state) || undefined,
        zip: normalizeString(company?.zip) || undefined,
        lifecycleStatus,
        lifecycleReason: contact.lifecycleReason || null,
        lifecycleUpdatedAt: contact.lifecycleUpdatedAt || undefined,
        holdUntilAt: contact.holdUntilAt || undefined,
        reviewReasons: Array.isArray(contact.reviewReasons) ? contact.reviewReasons : [],
        duplicateOfContactId: contact.duplicateOfContactId || null,
        emailStatus,
        suppressionReason,
        lastValidatedAt: contact.lastValidatedAt || undefined,
        validationSource: contact.validationSource || null,
        lastEngagementEvent,
        lastEngagementAt,
        emailEngagement: contact.emailEngagement || undefined,
        sequenceHistory: contact.sequenceHistory || undefined,
        hasActiveSequence: hasActiveSequence(contact),
        sequenceEligible: isSequenceEligible(contact),
        isPrimary: !!contact.isPrimary,
        companyStage,
        outreachStatus: normalizeString(company?.outreachStatus) || null,
        attribution: company?.attribution || undefined,
        preferredAuditTimes: company?.preferredAuditTimes || undefined,
        createdAt: contact.createdAt || contact.updatedAt || company?.createdAt || admin.firestore.Timestamp.now(),
        updatedAt: contact.updatedAt || undefined,
        searchText: buildSearchText([
            contactName,
            contact.email,
            contact.phone,
            contact.companyName,
            company?.businessName,
            company?.address,
            company?.city,
            company?.state,
            getContactRole(contact),
            company?.facilityType,
        ]),
        sortCompanyName: toLower(contact.companyName || company?.businessName),
        sortContactName: toLower(contactName),
    };
}

export async function projectCrmContactRow(contactId: string): Promise<CrmContactRow | null> {
    const contactDoc = await db.collection("contacts").doc(contactId).get();
    if (!contactDoc.exists) {
        await db.collection("crm_contact_rows").doc(contactId).delete().catch(() => undefined);
        return null;
    }

    const contact = contactDoc.data() || {};
    const companyId = normalizeString(contact.companyId);
    const resolvedCompany = companyId ? await resolveOperationalCompany(companyId) : null;
    const row = mapContactRow(contactId, contact, resolvedCompany?.data);

    await db.collection("crm_contact_rows").doc(contactId).set({
        ...row,
        id: contactId,
        projectedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return row;
}

export async function deleteCrmContactRow(contactId: string): Promise<void> {
    await db.collection("crm_contact_rows").doc(contactId).delete().catch(() => undefined);
}

export async function projectCrmCompanyRow(companyId: string): Promise<CrmCompanyRow | null> {
    const resolvedCompany = await resolveOperationalCompany(companyId);
    if (!resolvedCompany) {
        await db.collection("crm_company_rows").doc(companyId).delete().catch(() => undefined);
        return null;
    }

    const company = resolvedCompany.data;
    const contactsSnap = await db.collection("contacts").where("companyId", "==", companyId).get();
    const contacts = contactsSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() || {} }));

    const activeContacts = contacts.filter(({ data }) => getContactLifecycle(data) === "active" && !data.duplicateOfContactId);
    const suppressedContacts = contacts.filter(({ data }) => getContactLifecycle(data) === "suppressed");
    const deliverableContacts = contacts.filter(({ data }) => isSequenceEligible(data));
    const needsReviewContacts = contacts.filter(({ data }) => {
        const lifecycle = getContactLifecycle(data);
        const emailStatus = getEmailStatus(data);
        return lifecycle === "review" || lifecycle === "duplicate" || lifecycle === "held" || emailStatus === "bounced" || emailStatus === "spam" || emailStatus === "invalid";
    });

    const preferredContact = [...contacts].sort((a, b) => scorePreferredContact(b.data) - scorePreferredContact(a.data))[0];
    const preferredName = preferredContact ? getContactName(preferredContact.data).fullName : "";
    const stageFromPreferred = preferredContact ? deriveCompanyStage(company, preferredContact.data) : (normalizeString(company.status || "new") as LeadStatus);

    const row: CrmCompanyRow = {
        companyId,
        businessName: normalizeString(company.businessName || company.name) || "Unknown",
        facilityType: normalizeString(company.facilityType) || undefined,
        leadType: company.leadType,
        locationText: buildLocationText(company) || undefined,
        address: normalizeString(company.address) || undefined,
        city: normalizeString(company.city) || undefined,
        state: normalizeString(company.state) || undefined,
        zip: normalizeString(company.zip) || undefined,
        phone: normalizeString(company.phone) || undefined,
        website: normalizeString(company.website) || undefined,
        companyStage: stageFromPreferred || "new",
        outreachStatus: normalizeString(company.outreachStatus) || null,
        primaryContactId: preferredContact?.id || company.primaryContactId || null,
        primaryContactName: preferredName || null,
        primaryContactEmail: normalizeString(preferredContact?.data.email) || null,
        deliverableContactCount: deliverableContacts.length,
        activeContactCount: activeContacts.length,
        suppressedContactCount: suppressedContacts.length,
        needsReviewCount: needsReviewContacts.length,
        totalContactCount: contacts.length,
        primaryContactIdLegacy: company.primaryContactId || null,
        contractId: normalizeString(company.contractId) || undefined,
        assignedFsmId: normalizeString(company.assignedFsmId) || undefined,
        createdAt: company.createdAt || undefined,
        updatedAt: company.updatedAt || undefined,
        searchText: buildSearchText([
            company.businessName,
            company.name,
            company.website,
            company.phone,
            company.address,
            company.city,
            company.state,
            company.zip,
            company.facilityType,
            preferredName,
            preferredContact?.data.email,
        ]),
        sortBusinessName: toLower(company.businessName || company.name),
    };

    await db.collection("crm_company_rows").doc(companyId).set({
        ...row,
        id: companyId,
        projectedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return row;
}

export async function deleteCrmCompanyRow(companyId: string): Promise<void> {
    await db.collection("crm_company_rows").doc(companyId).delete().catch(() => undefined);
}

export async function reprojectContactsForCompany(companyId: string): Promise<number> {
    const contactsSnap = await db.collection("contacts").where("companyId", "==", companyId).get();
    await Promise.all(contactsSnap.docs.map((docSnap) => projectCrmContactRow(docSnap.id)));
    return contactsSnap.size;
}
