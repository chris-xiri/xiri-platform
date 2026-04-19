import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {
    deleteCrmCompanyRow,
    deleteCrmContactRow,
    projectCrmCompanyRow,
    projectCrmContactRow,
    reprojectContactsForCompany,
} from "../utils/crmProjection";

export const onContactProjected = onDocumentWritten("contacts/{contactId}", async (event) => {
    const contactId = event.params.contactId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const beforeCompanyId = before?.companyId || null;
    const afterCompanyId = after?.companyId || null;

    if (!event.data?.after?.exists) {
        await deleteCrmContactRow(contactId);
        if (beforeCompanyId) {
            await projectCrmCompanyRow(beforeCompanyId);
        }
        return;
    }

    await projectCrmContactRow(contactId);

    const companyIds = new Set<string>();
    if (beforeCompanyId) companyIds.add(beforeCompanyId);
    if (afterCompanyId) companyIds.add(afterCompanyId);

    await Promise.all(Array.from(companyIds).map((companyId) => projectCrmCompanyRow(companyId)));
});

export const onCompanyProjected = onDocumentWritten("companies/{companyId}", async (event) => {
    const companyId = event.params.companyId;

    if (!event.data?.after?.exists) {
        await deleteCrmCompanyRow(companyId);
        await reprojectContactsForCompany(companyId);
        return;
    }

    const contactCount = await reprojectContactsForCompany(companyId);
    await projectCrmCompanyRow(companyId);
    logger.info(`[CrmProjection] Reprojected company ${companyId} and ${contactCount} contact rows`);
});

export const onLegacyLeadProjected = onDocumentWritten("leads/{leadId}", async (event) => {
    const leadId = event.params.leadId;

    if (!event.data?.after?.exists) {
        await deleteCrmCompanyRow(leadId);
        await reprojectContactsForCompany(leadId);
        return;
    }

    // Only project legacy lead rows when there isn't a canonical company doc.
    await reprojectContactsForCompany(leadId);
    await projectCrmCompanyRow(leadId);
});
