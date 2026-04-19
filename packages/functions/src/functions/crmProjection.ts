import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../utils/firebase";
import { projectCrmCompanyRow, projectCrmContactRow } from "../utils/crmProjection";

async function requireAdmin(uid?: string | null) {
    if (!uid) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const userDoc = await db.collection("users").doc(uid).get();
    const roles = (userDoc.data()?.roles || []) as string[];
    if (!roles.includes("admin")) {
        throw new HttpsError("permission-denied", "Admin role required.");
    }
}

export const rebuildCrmContactRows = onCall(async (request) => {
    await requireAdmin(request.auth?.uid);

    const dryRun = !!request.data?.dryRun;
    const contactId = request.data?.contactId as string | undefined;
    const companyId = request.data?.companyId as string | undefined;

    let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (contactId) {
        const docSnap = await db.collection("contacts").doc(contactId).get();
        if (docSnap.exists) {
            docs = [docSnap as FirebaseFirestore.QueryDocumentSnapshot];
        }
    } else if (companyId) {
        const snap = await db.collection("contacts").where("companyId", "==", companyId).get();
        docs = snap.docs;
    } else {
        const snap = await db.collection("contacts").get();
        docs = snap.docs;
    }

    if (!dryRun) {
        for (const docSnap of docs) {
            await projectCrmContactRow(docSnap.id);
        }
    }

    logger.info(`[CrmProjection] rebuildCrmContactRows scanned=${docs.length} dryRun=${dryRun}`);
    return { success: true, scanned: docs.length, updated: dryRun ? 0 : docs.length, dryRun };
});

export const rebuildCrmCompanyRows = onCall(async (request) => {
    await requireAdmin(request.auth?.uid);

    const dryRun = !!request.data?.dryRun;
    const companyId = request.data?.companyId as string | undefined;

    const ids = new Set<string>();
    if (companyId) {
        ids.add(companyId);
    } else {
        const [companiesSnap, leadsSnap, contactsSnap] = await Promise.all([
            db.collection("companies").get(),
            db.collection("leads").get(),
            db.collection("contacts").select("companyId").get(),
        ]);
        companiesSnap.docs.forEach((docSnap) => ids.add(docSnap.id));
        leadsSnap.docs.forEach((docSnap) => ids.add(docSnap.id));
        contactsSnap.docs.forEach((docSnap) => {
            const id = docSnap.data()?.companyId;
            if (id) ids.add(id);
        });
    }

    if (!dryRun) {
        for (const id of ids) {
            await projectCrmCompanyRow(id);
        }
    }

    logger.info(`[CrmProjection] rebuildCrmCompanyRows scanned=${ids.size} dryRun=${dryRun}`);
    return { success: true, scanned: ids.size, updated: dryRun ? 0 : ids.size, dryRun };
});
