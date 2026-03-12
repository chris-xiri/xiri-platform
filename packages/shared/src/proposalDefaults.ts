import type { ProposalTerms } from './generateProposal';

/**
 * Maps a supply policy string to the corresponding equipment/supplies description text.
 * Handles both calculator-style ("client", "shared", "company") and Firestore-style
 * ("customer_provides", "both", "we_provide") policy values.
 */
export function buildEquipmentText(
    companyData: Record<string, any>,
    supplyPolicy?: string
): string {
    const base = companyData.equipmentDescription || '';
    const policy = supplyPolicy || companyData.suppliesPolicy || '';
    // Normalize calculator supplyPolicy → Firestore policy name
    const mapped =
        policy === 'client' ? 'customer_provides' :
        policy === 'shared' ? 'both' :
        policy === 'company' ? 'we_provide' :
        policy;

    if (mapped === 'we_provide') {
        const weProvide = companyData.suppliesWeProvide || '';
        return [
            base,
            weProvide
                ? `All cleaning supplies are provided by us: ${weProvide}.`
                : 'All cleaning supplies are provided by our company.',
        ].filter(Boolean).join('\n\n');
    } else if (mapped === 'customer_provides') {
        const custProvide = companyData.suppliesCustomerProvides || '';
        return [
            base,
            custProvide
                ? `Cleaning supplies are provided by the client: ${custProvide}.`
                : 'Cleaning supplies are provided by the client.',
        ].filter(Boolean).join('\n\n');
    } else if (mapped === 'both') {
        const parts: string[] = [base];
        if (companyData.suppliesWeProvide) parts.push(`We provide: ${companyData.suppliesWeProvide}.`);
        if (companyData.suppliesCustomerProvides) parts.push(`Client provides: ${companyData.suppliesCustomerProvides}.`);
        if (!companyData.suppliesWeProvide && !companyData.suppliesCustomerProvides) {
            parts.push('Supplies are shared between our company and the client.');
        }
        return parts.filter(Boolean).join('\n\n');
    }
    return base;
}

/**
 * Builds a ProposalTerms object from company Firestore data.
 * Used as default values when creating a new quote — the user can then toggle/edit per deal.
 *
 * @param companyData - Raw Firestore company document fields
 * @param supplyPolicy - Optional supply policy from calculator inputs (overrides company default)
 */
export function buildDefaultTerms(
    companyData: Record<string, any>,
    supplyPolicy?: string
): ProposalTerms {
    return {
        legalName: companyData.legalName || companyData.name || '',
        employeeStatus: companyData.employeeStatus || '',
        supervisionApproach: companyData.supervisionApproach || '',
        companyPhilosophy: companyData.companyPhilosophy || '',
        cancellationPolicy: companyData.cancellationPolicy || '',
        serviceGuarantee: companyData.serviceGuarantee || '',
        lateFeePolicy: companyData.lateFeePolicy || '',
        equipmentDescription: buildEquipmentText(companyData, supplyPolicy),
        specialServices: companyData.specialServices || '',
        suppliesPolicy: companyData.suppliesPolicy || '',
        suppliesWeProvide: companyData.suppliesWeProvide || '',
        suppliesCustomerProvides: companyData.suppliesCustomerProvides || '',
        contractTerm: companyData.contractTerm || '',
        additionalTerms: companyData.additionalTerms || '',
        bonded: companyData.bonded || false,
        bondAmount: companyData.bondAmount || '',
        uniformedPersonnel: companyData.uniformedPersonnel || false,
    };
}

/** All T&C field definitions for rendering the terms editor UI */
export const PROPOSAL_TERM_FIELDS: { key: keyof ProposalTerms; label: string }[] = [
    { key: 'legalName', label: 'Legal Entity Name' },
    { key: 'cancellationPolicy', label: 'Cancellation Policy' },
    { key: 'lateFeePolicy', label: 'Late Fee / Payment Terms' },
    { key: 'serviceGuarantee', label: 'Service Guarantee' },
    { key: 'equipmentDescription', label: 'Equipment & Supplies' },
    { key: 'employeeStatus', label: 'Employee Status' },
    { key: 'supervisionApproach', label: 'Supervision & QC' },
    { key: 'companyPhilosophy', label: 'Company Philosophy' },
    { key: 'specialServices', label: 'Special Services' },
    { key: 'contractTerm', label: 'Contract Term' },
    { key: 'additionalTerms', label: 'Additional Terms' },
];
