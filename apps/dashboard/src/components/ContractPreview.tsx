'use client';

import { QuoteLineItem } from '@xiri/shared';

interface ContractPreviewProps {
    contract: any;
    lead: any;
    workOrders: any[];
}

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

const formatDate = (d: any): string => {
    if (!d) return '_______________';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function ContractPreview({ contract, lead, workOrders }: ContractPreviewProps) {
    const monthlyRate = contract.totalMonthlyRate || contract.monthlyRate || 0;
    const oneTimeCharges = contract.oneTimeCharges || 0;
    const tenure = contract.contractTenure || contract.tenure || 0;
    const lineItems: QuoteLineItem[] = contract.lineItems || [];
    const recurringItems = lineItems.filter(li => li.frequency !== 'one_time');
    const oneTimeItems = lineItems.filter(li => li.frequency === 'one_time');
    const recurringTotal = recurringItems.reduce((s, li) => s + (li.clientRate || 0), 0);
    const oneTimeTotal = oneTimeItems.reduce((s, li) => s + (li.clientRate || 0), 0);
    const clientName = contract.clientBusinessName || contract.clientName || '_______________';
    const clientAddress = lead?.address || contract.clientAddress || '_______________';
    const contactName = contract.signerName || lead?.contactName || lead?.name || '_______________';
    const contactTitle = contract.signerTitle || '_______________';
    const startDate = formatDate(contract.startDate);
    const paymentTerms = contract.paymentTerms || 'Net 30';
    const exitClause = contract.exitClause || '30-day written notice';

    // Group line items by location
    const locationMap = new Map<string, QuoteLineItem[]>();
    lineItems.forEach(li => {
        const key = li.locationName || 'Primary Location';
        if (!locationMap.has(key)) locationMap.set(key, []);
        locationMap.get(key)!.push(li);
    });

    const formatFrequency = (freq: string, days?: boolean[]) => {
        if (freq === 'custom_days' && days) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return days.map((d, i) => d ? dayNames[i] : null).filter(Boolean).join(', ');
        }
        const map: Record<string, string> = {
            daily: 'Daily (7 days/week)',
            weekdays: 'Monday – Friday',
            weekly: 'Once per week',
            biweekly: 'Every two weeks',
            monthly: 'Once per month',
            quarterly: 'Once per quarter',
            one_time: 'One-time service',
        };
        return map[freq] || freq?.replace(/_/g, ' ') || '—';
    };

    const getBillingType = (freq: string) => {
        return ['one_time', 'quarterly'].includes(freq) ? 'One-Time' : 'Recurring';
    };

    return (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            {/* Print-friendly container */}
            <div className="max-w-[800px] mx-auto py-10 px-12 text-sm leading-relaxed text-gray-800 print:py-0 print:px-0 print:shadow-none" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>

                {/* Header / Letterhead */}
                <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
                    <h1 className="text-2xl font-bold tracking-wide uppercase text-gray-900" style={{ letterSpacing: '0.15em' }}>
                        XIRI FACILITY SOLUTIONS
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 tracking-wider uppercase">
                        Professional Facility Management Services
                    </p>
                    <div className="mt-4 text-xs text-gray-500">
                        <p>www.xirifacilitysolutions.com • info@xirifacilitysolutions.com</p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                        Facility Services Agreement
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Contract ID: {contract.id}</p>
                    {contract.status === 'amended' && (
                        <p className="text-xs text-blue-600 font-medium mt-1">— AMENDED —</p>
                    )}
                </div>

                {/* Parties */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">1. Parties</h3>
                    <p className="mb-2">
                        This Facility Services Agreement (the <strong>"Agreement"</strong>) is entered into as of{' '}
                        <span className="border-b border-gray-400 px-1 font-medium">{startDate}</span>{' '}
                        by and between:
                    </p>
                    <div className="grid grid-cols-2 gap-6 mt-4">
                        <div className="border rounded-lg p-4 bg-gray-50">
                            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Service Provider</p>
                            <p className="font-bold">XIRI Facility Solutions, LLC</p>
                            <p className="text-xs text-gray-600 mt-1">
                                Hereinafter referred to as "XIRI" or "Provider"
                            </p>
                        </div>
                        <div className="border rounded-lg p-4 bg-gray-50">
                            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Client</p>
                            <p className="font-bold">{clientName}</p>
                            <p className="text-xs text-gray-600 mt-1">{clientAddress}</p>
                            <p className="text-xs text-gray-600">
                                Hereinafter referred to as "Client"
                            </p>
                        </div>
                    </div>
                </div>

                {/* Scope of Services */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">2. Scope of Services</h3>
                    <p className="mb-4">
                        Provider agrees to furnish the following facility management services at the locations
                        specified below, subject to the terms and conditions of this Agreement:
                    </p>

                    {/* Recurring Services */}
                    {recurringItems.length > 0 && (
                        <>
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">A. Recurring Services</p>
                            {Array.from(
                                recurringItems.reduce((map, li) => {
                                    const key = li.locationName || 'Primary Location';
                                    if (!map.has(key)) map.set(key, []);
                                    map.get(key)!.push(li);
                                    return map;
                                }, new Map<string, QuoteLineItem[]>())
                            ).map(([locName, items]) => (
                                <div key={locName} className="mb-4">
                                    <div className="bg-gray-100 px-4 py-2 rounded-t-lg border border-b-0">
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
                                            📍 {locName}
                                        </p>
                                        {items[0]?.locationAddress && (
                                            <p className="text-xs text-gray-500">{items[0].locationAddress}</p>
                                        )}
                                    </div>
                                    <table className="w-full border border-t-0 text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b">
                                                <th className="text-left py-2 px-3 font-semibold text-gray-600">Service</th>
                                                <th className="text-left py-2 px-3 font-semibold text-gray-600">Frequency</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600">Monthly Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={item.id || idx} className="border-b last:border-0">
                                                    <td className="py-2 px-3">
                                                        {item.serviceType}
                                                        {item.description && (
                                                            <span className="text-gray-500 block text-[10px]">{item.description}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-600">
                                                        {formatFrequency(item.frequency, item.daysOfWeek)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-medium">
                                                        {formatCurrency(item.clientRate)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                            <div className="border-2 border-gray-800 rounded-lg p-4 flex justify-between items-center mb-6">
                                <span className="font-bold text-gray-900">TOTAL MONTHLY RECURRING</span>
                                <span className="text-xl font-bold text-gray-900">{formatCurrency(recurringTotal || monthlyRate)}/mo</span>
                            </div>
                        </>
                    )}

                    {/* One-Time Services */}
                    {oneTimeItems.length > 0 && (
                        <>
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">B. One-Time Services</p>
                            {Array.from(
                                oneTimeItems.reduce((map, li) => {
                                    const key = li.locationName || 'Primary Location';
                                    if (!map.has(key)) map.set(key, []);
                                    map.get(key)!.push(li);
                                    return map;
                                }, new Map<string, QuoteLineItem[]>())
                            ).map(([locName, items]) => (
                                <div key={locName} className="mb-4">
                                    <div className="bg-amber-50 px-4 py-2 rounded-t-lg border border-b-0">
                                        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                            📍 {locName}
                                        </p>
                                    </div>
                                    <table className="w-full border border-t-0 text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b">
                                                <th className="text-left py-2 px-3 font-semibold text-gray-600">Service</th>
                                                <th className="text-right py-2 px-3 font-semibold text-gray-600">Flat Fee</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={item.id || idx} className="border-b last:border-0">
                                                    <td className="py-2 px-3">
                                                        {item.serviceType}
                                                        {item.description && (
                                                            <span className="text-gray-500 block text-[10px]">{item.description}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-medium">
                                                        {formatCurrency(item.clientRate)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                            <div className="border-2 border-amber-600 rounded-lg p-4 flex justify-between items-center mb-6">
                                <span className="font-bold text-gray-900">TOTAL ONE-TIME CHARGES</span>
                                <span className="text-xl font-bold text-amber-700">{formatCurrency(oneTimeTotal || oneTimeCharges)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Term */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">3. Term of Agreement</h3>
                    <p>
                        This Agreement shall commence on <strong>{startDate}</strong> and
                        shall continue for a period of <strong>{tenure} months</strong>,
                        unless earlier terminated in accordance with Section 6.
                    </p>
                </div>

                {/* Compensation */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">4. Compensation & Payment</h3>
                    <p className="mb-2">
                        Client agrees to compensate Provider for all services described in Section 2 as follows:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                        {(recurringTotal || monthlyRate) > 0 && (
                            <li><strong>Monthly Recurring Payment:</strong> {formatCurrency(recurringTotal || monthlyRate)} per month for all recurring services.</li>
                        )}
                        {(oneTimeTotal || oneTimeCharges) > 0 && (
                            <li><strong>One-Time Service Charges:</strong> {formatCurrency(oneTimeTotal || oneTimeCharges)}, to be invoiced upon completion of one-time services.</li>
                        )}
                        <li>Payment terms: <strong>{paymentTerms}</strong> from date of invoice.</li>
                        <li>Monthly invoices will be issued on the 1st of each calendar month for the upcoming recurring service period.</li>
                        <li>Late payments are subject to a 1.5% monthly service charge after the due date.</li>
                        {(recurringTotal || monthlyRate) > 0 && (
                            <li>Total Contract Value (12 months): <strong>{formatCurrency(((recurringTotal || monthlyRate) * 12) + (oneTimeTotal || oneTimeCharges))}</strong></li>
                        )}
                    </ul>
                </div>

                {/* Quality Assurance */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">5. Quality Assurance & Compliance</h3>
                    <p className="mb-2">Provider agrees to maintain the following standards:</p>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                        <li><strong>Nightly Audits:</strong> Provider's Night Manager will conduct nightly quality inspections of all recurring services.</li>
                        <li><strong>Weekly Site Visits:</strong> A dedicated Facility Solutions Manager (FSM) will visit each service location at least once per week.</li>
                        <li><strong>HIPAA Compliance:</strong> All personnel servicing medical facilities will adhere to HIPAA guidelines for protected health information.</li>
                        <li><strong>Background Checks:</strong> All service personnel will undergo comprehensive background screening prior to assignment.</li>
                        <li><strong>Insurance:</strong> Provider maintains General Liability and Workers' Compensation insurance as required by law.</li>
                    </ul>
                </div>

                {/* Termination */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">6. Termination</h3>
                    <p>
                        Either party may terminate this Agreement by providing <strong>{exitClause}</strong> to
                        the other party. Upon termination, Client shall pay for all services rendered through
                        the effective date of termination.
                    </p>
                </div>

                {/* General Provisions */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">7. General Provisions</h3>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                        <li><strong>Amendments:</strong> This Agreement may be amended only by written consent of both parties. Service additions will be documented as contract amendments.</li>
                        <li><strong>Governing Law:</strong> This Agreement shall be governed by and construed in accordance with applicable state law.</li>
                        <li><strong>Entire Agreement:</strong> This Agreement, together with its amendments, constitutes the entire agreement between the parties.</li>
                        <li><strong>Confidentiality:</strong> Both parties agree to keep confidential all proprietary information disclosed under this Agreement.</li>
                    </ul>
                </div>

                {/* Signatures */}
                <div className="mt-12 border-t-2 border-gray-800 pt-8">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-6">Signatures</h3>
                    <p className="text-xs text-gray-500 mb-6">
                        IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.
                    </p>
                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">XIRI Facility Solutions, LLC</p>
                            <div>
                                <div className="border-b border-gray-400 h-10"></div>
                                <p className="text-xs text-gray-500 mt-1">Signature</p>
                            </div>
                            <div>
                                <div className="border-b border-gray-400 h-6"></div>
                                <p className="text-xs text-gray-500 mt-1">Printed Name & Title</p>
                            </div>
                            <div>
                                <div className="border-b border-gray-400 h-6"></div>
                                <p className="text-xs text-gray-500 mt-1">Date</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">{clientName}</p>
                            <div>
                                <div className="border-b border-gray-400 h-10"></div>
                                <p className="text-xs text-gray-500 mt-1">Signature</p>
                            </div>
                            <div>
                                <p className="border-b border-gray-400 pb-1 text-sm">{contactName}, {contactTitle}</p>
                                <p className="text-xs text-gray-500 mt-1">Printed Name & Title</p>
                            </div>
                            <div>
                                <div className="border-b border-gray-400 h-6"></div>
                                <p className="text-xs text-gray-500 mt-1">Date</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400">
                    <p>XIRI Facility Solutions, LLC — Confidential</p>
                    <p>This document is system-generated. Contract ID: {contract.id}</p>
                </div>
            </div>
        </div>
    );
}
