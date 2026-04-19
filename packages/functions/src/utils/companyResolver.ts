import { db } from "./firebase";

export interface ResolvedOperationalCompany {
    id: string;
    collection: "companies" | "leads";
    data: FirebaseFirestore.DocumentData;
    exists: boolean;
}

export async function resolveOperationalCompany(companyId: string): Promise<ResolvedOperationalCompany | null> {
    const companyDoc = await db.collection("companies").doc(companyId).get();
    if (companyDoc.exists) {
        return {
            id: companyDoc.id,
            collection: "companies",
            data: companyDoc.data() || {},
            exists: true,
        };
    }

    const leadDoc = await db.collection("leads").doc(companyId).get();
    if (leadDoc.exists) {
        return {
            id: leadDoc.id,
            collection: "leads",
            data: leadDoc.data() || {},
            exists: true,
        };
    }

    return null;
}
