import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { DASHBOARD_CORS } from "../utils/cors";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

type ContactDoc = admin.firestore.DocumentData & {
    companyId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isPrimary?: boolean;
    lifecycleStatus?: string;
    lifecycleReason?: string | null;
    unsubscribed?: boolean;
    emailEngagement?: {
        lastEvent?: string;
        openCount?: number;
        clickCount?: number;
    };
    reviewReasons?: string[];
};

function asCleanString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeEmail(email?: string): string {
    return asCleanString(email).toLowerCase();
}

function normalizeName(firstName?: string, lastName?: string): string {
    const first = asCleanString(firstName).toLowerCase();
    const last = asCleanString(lastName).toLowerCase();
    return `${first} ${last}`.trim();
}

function scoreContact(contact: ContactDoc): number {
    let score = 0;
    const lifecycle = contact.lifecycleStatus || (contact.unsubscribed ? "suppressed" : "active");
    if (contact.isPrimary) score += 100;
    if (lifecycle === "active") score += 50;
    if (lifecycle === "held") score += 15;
    if (lifecycle === "suppressed") score -= 50;
    if (!contact.unsubscribed) score += 10;

    const engagement = contact.emailEngagement;
    if (engagement?.lastEvent === "clicked") score += 15;
    if (engagement?.lastEvent === "opened") score += 8;
    if (engagement?.lastEvent === "delivered") score += 4;
    if (engagement?.lastEvent === "bounced" || engagement?.lastEvent === "spam") score -= 20;

    const email = normalizeEmail(contact.email);
    if (email && !email.startsWith("info@") && !email.startsWith("hello@") && !email.startsWith("admin@")) {
        score += 5;
    }

    return score;
}

function pickWinner(contacts: Array<{ id: string; data: ContactDoc }>) {
    return [...contacts].sort((a, b) => scoreContact(b.data) - scoreContact(a.data))[0];
}

export const refreshContactReviewQueue = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
    }

    const snapshot = await db.collection("contacts").get();
    const byCompany = new Map<string, Array<{ id: string; data: ContactDoc }>>();

    snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ContactDoc;
        const companyId = data.companyId;
        if (!companyId) return;
        const group = byCompany.get(companyId) || [];
        group.push({ id: docSnap.id, data });
        byCompany.set(companyId, group);
    });

    const updates = new Map<string, Record<string, any>>();
    let exactDuplicateCount = 0;
    let nameCandidateCount = 0;
    let lifecycleBackfillCount = 0;
    let malformedReviewReasonsCount = 0;

    const ensureUpdate = (contactId: string) => {
        const existing = updates.get(contactId) || {};
        updates.set(contactId, existing);
        return existing;
    };

    for (const contacts of byCompany.values()) {
        const byEmail = new Map<string, Array<{ id: string; data: ContactDoc }>>();
        const byName = new Map<string, Array<{ id: string; data: ContactDoc }>>();

        for (const contact of contacts) {
            const email = normalizeEmail(contact.data.email);
            const name = normalizeName(contact.data.firstName, contact.data.lastName);
            const reviewReasons = asStringArray(contact.data.reviewReasons);
            if (contact.data.reviewReasons && !Array.isArray(contact.data.reviewReasons)) {
                malformedReviewReasonsCount++;
            }

            if (!contact.data.lifecycleStatus) {
                const update = ensureUpdate(contact.id);
                update.lifecycleStatus = contact.data.unsubscribed ? "suppressed" : "active";
                update.lifecycleUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
                lifecycleBackfillCount++;
            }

            if (email) {
                const emailGroup = byEmail.get(email) || [];
                emailGroup.push(contact);
                byEmail.set(email, emailGroup);
            }

            if (name) {
                const nameGroup = byName.get(name) || [];
                nameGroup.push(contact);
                byName.set(name, nameGroup);
            }
        }

        for (const group of byEmail.values()) {
            if (group.length < 2) continue;
            const winner = pickWinner(group);

            for (const contact of group) {
                const update = ensureUpdate(contact.id);
                const existingReasons = new Set(asStringArray(contact.data.reviewReasons).filter(reason => reason !== "duplicate_name_candidate"));

                if (contact.id === winner.id) {
                    if (contact.data.lifecycleStatus === "duplicate" && contact.data.lifecycleReason === "duplicate_email") {
                        update.lifecycleStatus = "active";
                        update.lifecycleReason = null;
                        update.lifecycleUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
                    }
                    update.duplicateOfContactId = null;
                    update.reviewReasons = Array.from(existingReasons);
                    continue;
                }

                update.lifecycleStatus = "duplicate";
                update.lifecycleReason = "duplicate_email";
                update.lifecycleUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
                update.duplicateOfContactId = winner.id;
                update.reviewReasons = Array.from(existingReasons);
                exactDuplicateCount++;
            }
        }

        for (const group of byName.values()) {
            if (group.length < 2) continue;
            const uniqueEmails = new Set(group.map(contact => normalizeEmail(contact.data.email)).filter(Boolean));
            if (uniqueEmails.size <= 1) continue;

            const winner = pickWinner(group);
            for (const contact of group) {
                if (contact.id === winner.id) {
                    const update = ensureUpdate(contact.id);
                    const remainingReasons = asStringArray(contact.data.reviewReasons).filter(reason => reason !== "duplicate_name_candidate");
                    update.reviewReasons = remainingReasons;
                    continue;
                }

                const update = ensureUpdate(contact.id);
                const nextReviewReasons = new Set(asStringArray(contact.data.reviewReasons));
                nextReviewReasons.add("duplicate_name_candidate");
                update.reviewReasons = Array.from(nextReviewReasons);

                if (!contact.data.lifecycleStatus || contact.data.lifecycleStatus === "active") {
                    update.lifecycleStatus = "review";
                    update.lifecycleReason = "duplicate_name_candidate";
                    update.lifecycleUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
                }
                nameCandidateCount++;
            }
        }
    }

    const BATCH_LIMIT = 400;
    const entries = Array.from(updates.entries());
    for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const [contactId, rawUpdate] of entries.slice(i, i + BATCH_LIMIT)) {
            const update: Record<string, any> = {};
            for (const [key, value] of Object.entries(rawUpdate)) {
                if (key === "reviewReasons" && Array.isArray(value) && value.length === 0) {
                    update[key] = admin.firestore.FieldValue.delete();
                } else if (key === "duplicateOfContactId" && !value) {
                    update[key] = null;
                } else {
                    update[key] = value;
                }
            }
            batch.set(db.collection("contacts").doc(contactId), update, { merge: true });
        }
        await batch.commit();
    }

    return {
        scannedContacts: snapshot.size,
        updatedContacts: entries.length,
        exactDuplicateCount,
        nameCandidateCount,
        lifecycleBackfillCount,
        malformedReviewReasonsCount,
    };
});
