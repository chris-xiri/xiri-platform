'use client';

import { useEffect, useRef, useState } from 'react';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Copy, Download, Mail, Send } from 'lucide-react';
import { buildRfpDraft, type RfpDocument, type RfpInput } from '@xiri-facility-solutions/shared';
import { trackEvent } from '@/lib/tracking';

const DEFAULT_INPUT: RfpInput = {
    facilityName: '',
    facilityType: 'Commercial Office',
    location: 'Queens, NY',
    estimatedSqft: 10000,
    cleaningFrequency: 'weekdays',
    serviceWindow: '6pm-5am',
    requiredServices: ['Nightly janitorial', 'Restroom disinfection', 'Trash removal'],
    complianceRequirements: ['Insurance COI', 'SDS binder', 'OSHA training records'],
    slaRequirements: ['Issue response under 2 hours', 'Missed service escalation same day'],
    transitionDate: '',
    incumbentPainPoints: ['Inconsistent quality control', 'No verifiable proof-of-cleaning'],
};


function formatWithCommas(value: number): string {
    const digits = String(Math.max(0, Math.floor(value || 0)));
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface RfpBidAnalyzerToolProps {
    initialInput?: Partial<RfpInput>;
}

export default function RfpBidAnalyzerTool({ initialInput }: RfpBidAnalyzerToolProps = {}) {
    const mergedDefault: RfpInput = { ...DEFAULT_INPUT, ...(initialInput || {}) };
    const [brief, setBrief] = useState('');
    const [input, setInput] = useState<RfpInput>(mergedDefault);
    const [rfpDraft, setRfpDraft] = useState<RfpDocument | null>(null);
    const [showRfpPreview, setShowRfpPreview] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [sqftInput, setSqftInput] = useState(formatWithCommas(mergedDefault.estimatedSqft));
    const [showComprehensiveBriefHelp, setShowComprehensiveBriefHelp] = useState(false);
    const [rfpActionStatus, setRfpActionStatus] = useState('');
    const [showEmailOptions, setShowEmailOptions] = useState(false);
    const [showDownloadOptions, setShowDownloadOptions] = useState(false);
    const [isSubmittingXiri, setIsSubmittingXiri] = useState(false);
    const [step2Error, setStep2Error] = useState('');
    const emailMenuRef = useRef<HTMLDivElement | null>(null);
    const downloadMenuRef = useRef<HTMLDivElement | null>(null);
    const rfpPreviewRef = useRef<HTMLElement | null>(null);
    const scopePromptSamples = [
        {
            label: 'Facility profile',
            detail: '18,000 sqft medical office in Queens, occupied 7am-7pm, cleaning needed after-hours.',
            badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        },
        {
            label: 'Current issues',
            detail: 'missed restocks, inconsistent restroom disinfection, no proof-of-cleaning logs for management.',
            badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        },
        {
            label: 'Service scope needed',
            detail: 'nightly janitorial, day porter 8am-2pm, weekly floor machine scrub, monthly high dusting.',
            badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        },
        {
            label: 'Compliance and standards',
            detail: 'OSHA BBP training records, SDS binder on-site, insured staff, supervisor QA walkthrough 3x/week.',
            badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        },
        {
            label: 'Transition expectations',
            detail: 'new vendor start by June 1, 2-week overlap, site lead onboarding, escalation contact within 30 minutes.',
            badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
        },
    ];

    const localParseBrief = (text: string): Partial<RfpInput> => {
        const lower = text.toLowerCase();
        const sqftMatch = lower.match(/(\d[\d,]{2,})\s*(sq\s*ft|sqft|square\s*feet|sf)?/i);
        const estimatedSqft = sqftMatch ? Number(sqftMatch[1].replace(/,/g, '')) : undefined;

        let cleaningFrequency: RfpInput['cleaningFrequency'] | undefined;
        if (lower.includes('daily') || lower.includes('7x')) cleaningFrequency = 'daily';
        else if (lower.includes('weekdays') || lower.includes('5x')) cleaningFrequency = 'weekdays';
        else if (lower.includes('3x')) cleaningFrequency = '3x_week';
        else if (lower.includes('2x')) cleaningFrequency = '2x_week';
        else if (lower.includes('weekly') || lower.includes('1x')) cleaningFrequency = 'weekly';

        let facilityType: string | undefined;
        if (lower.includes('medical') || lower.includes('clinic')) facilityType = 'Medical / Clinic';
        else if (lower.includes('retail')) facilityType = 'Retail';
        else if (lower.includes('school') || lower.includes('daycare')) facilityType = 'Education';
        else if (lower.includes('warehouse')) facilityType = 'Warehouse / Industrial';

        const incumbentPainPoints: string[] = [];
        if (lower.includes('restock')) incumbentPainPoints.push('Missed restroom or consumable restocks');
        if (lower.includes('proof') || lower.includes('verify')) incumbentPainPoints.push('No verifiable proof-of-cleaning');
        if (lower.includes('quality')) incumbentPainPoints.push('Inconsistent quality control');

        return {
            estimatedSqft,
            cleaningFrequency,
            facilityType,
            incumbentPainPoints: incumbentPainPoints.length > 0 ? incumbentPainPoints : undefined,
        };
    };

    const renderSectionBody = (body: string) => {
        const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
        const blocks: Array<{ type: 'p' | 'ul'; text?: string; items?: string[] }> = [];
        let currentList: string[] = [];

        const flushList = () => {
            if (currentList.length > 0) {
                blocks.push({ type: 'ul', items: currentList });
                currentList = [];
            }
        };

        for (const line of lines) {
            if (line.startsWith('- ')) {
                currentList.push(line.slice(2).trim());
            } else {
                flushList();
                blocks.push({ type: 'p', text: line });
            }
        }
        flushList();

        return (
            <div className="space-y-2 text-sm text-slate-700">
                {blocks.map((block, index) =>
                    block.type === 'p' ? (
                        <p key={`p-${index}`}>{block.text}</p>
                    ) : (
                        <ul key={`ul-${index}`} className="list-disc pl-5 space-y-1">
                            {(block.items || []).map((item, itemIndex) => (
                                <li key={`li-${index}-${itemIndex}`}>{item}</li>
                            ))}
                        </ul>
                    )
                )}
            </div>
        );
    };

    const parseBulletItems = (body: string): string[] =>
        body
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('- '))
            .map((line) => line.slice(2).trim());

    const getSectionById = (id: string) => rfpDraft?.sections.find((section) => section.id === id);
    const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    const isValidUsZip = (value: string): boolean => /^\d{5}(?:-\d{4})?$/.test(value.trim());

    const buildRfpPlainText = (draft: RfpDocument): string => {
        const header = [
            draft.title,
            '',
            draft.summary,
            '',
            `Facility: ${input.facilityName?.trim() || 'N/A'}`,
            `Point of Contact: ${input.picName?.trim() || 'N/A'}`,
            `Proposal Submission Email: ${input.picEmail?.trim() || 'N/A'}`,
            `Type: ${input.facilityType}`,
            `Location: ${input.location}`,
            `ZIP Code: ${input.zipCode?.trim() || 'N/A'}`,
            `Estimated Square Footage: ${formatWithCommas(input.estimatedSqft)} sqft`,
            `Service Window: ${input.serviceWindow}`,
            `Target Transition Date: ${input.transitionDate || 'TBD'}`,
            '',
            '---',
            '',
        ];

        const sections = draft.sections.flatMap((section, idx) => [
            `${idx + 1}. ${section.title}`,
            section.body,
            '',
        ]);

        return [...header, ...sections].join('\n');
    };

    const escapeHtml = (value: string): string =>
        value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const buildRfpHtml = (draft: RfpDocument, options?: { includeTitle?: boolean }): string => {
        const includeTitle = options?.includeTitle ?? true;
        const requiredServices = parseBulletItems(getSectionById('required-services')?.body || '');
        const complianceItems = parseBulletItems(getSectionById('compliance-sla')?.body || '').slice(0, 8);
        const attachmentRequirements = [
            'Insurance COI',
            'Business license/entity documentation',
            'Sample QA report',
            'Transition plan timeline',
            'References/case studies',
        ];
        const detailRows = [
            ['Facility Name', input.facilityName?.trim() || 'Not specified'],
            ['Client PIC Name', input.picName?.trim() || 'Not specified'],
            ['Client PIC Email', input.picEmail?.trim() || 'Not specified'],
            ['Facility Type', input.facilityType],
            ['Location', input.location],
            ['ZIP Code', input.zipCode?.trim() || 'Not specified'],
            ['Estimated Square Footage', `${formatWithCommas(input.estimatedSqft)} sqft`],
            ['Service Window', input.serviceWindow],
            ['Target Transition Date', input.transitionDate || 'TBD'],
        ];

        const sectionHtml = draft.sections
            .filter((section) => section.id !== 'scope-overview')
            .map((section, index) => {
                const lines = section.body
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean);
                const bullets = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
                const paragraphs = lines.filter((line) => !line.startsWith('- '));

                const bulletHtml =
                    bullets.length > 0
                        ? `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
                        : '';
                const paragraphHtml = paragraphs
                    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
                    .join('');

                return `
                    <section class="block">
                        <h3>${index + 1}. ${escapeHtml(section.title)}</h3>
                        ${paragraphHtml}
                        ${bulletHtml}
                    </section>
                `;
            })
            .join('');

        const titleBlock = includeTitle
            ? `<h1>${escapeHtml(draft.title)}</h1><p class="muted">${escapeHtml(draft.summary)}</p>`
            : '';

        return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(draft.title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; line-height: 1.45; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    h2 { margin: 0; font-size: 20px; }
    h3 { margin: 0 0 10px; font-size: 18px; }
    p { margin: 0 0 10px; }
    .muted { color: #334155; }
    .panel { border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-top: 18px; }
    .panel-header { background: #f1f5f9; padding: 12px 14px; border-bottom: 1px solid #cbd5e1; }
    .panel-body { padding: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; width: 34%; }
    .grid { display: table; width: 100%; table-layout: fixed; border-spacing: 10px 0; margin-top: 10px; }
    .grid-col { display: table-cell; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; }
    ul, ol { margin: 8px 0 0 22px; }
    li { margin-bottom: 6px; }
    .block { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-top: 12px; page-break-inside: avoid; }
  </style>
</head>
<body>
  ${titleBlock}

  <section class="panel">
    <div class="panel-header">
      <h2>RFP Overview</h2>
      <p class="muted">Use this document to request comparable janitorial bids with clear scope, standards, and transition expectations.</p>
    </div>
    <div class="panel-body">
      <table>
        <tbody>
          ${detailRows
              .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
              .join('')}
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-header"><h2>How to Submit a Proposal</h2></div>
    <div class="panel-body">
      <p><strong>Submit proposals to:</strong> ${escapeHtml(input.picEmail?.trim() || 'TBD')}</p>
      <p><strong>Attention:</strong> ${escapeHtml(input.picName?.trim() || 'TBD')}</p>
      <p><strong>Subject format:</strong> RFP Response - ${escapeHtml(input.facilityName?.trim() || 'Facility')} - [Vendor Name]</p>
      <p><strong>Due date:</strong> ${escapeHtml(input.transitionDate || 'TBD')}</p>
      <ol>
        <li>Confirm your bid covers all required services and frequencies listed in this RFP.</li>
        <li>Include a monthly price, staffing plan, QA/reporting cadence, and compliance documentation.</li>
        <li>Provide a transition plan with start date, onboarding timeline, and escalation contacts.</li>
        <li>Clearly list any exclusions or assumptions so comparisons are apples-to-apples.</li>
      </ol>
      <p style="margin-top:10px;"><strong>Required attachments:</strong></p>
      <ul>${attachmentRequirements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>
  </section>

  <div class="grid">
    <div class="grid-col">
      <h2>Required Services</h2>
      <ul>${requiredServices.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>
    <div class="grid-col">
      <h2>Compliance & SLA Priorities</h2>
      <ul>${complianceItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>
  </div>

  ${sectionHtml}
</body>
</html>
        `.trim();
    };

    const copyRfpToClipboard = async (options?: { includeTitle?: boolean; successMessage?: string }) => {
        if (!rfpDraft) return;
        const text = buildRfpPlainText(rfpDraft);
        const html = buildRfpHtml(rfpDraft, { includeTitle: options?.includeTitle ?? true });

        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            const item = new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' }),
            });
            await navigator.clipboard.write([item]);
            setRfpActionStatus(options?.successMessage || 'Copied formatted RFP to clipboard.');
        } else {
            await navigator.clipboard.writeText(text);
            setRfpActionStatus('Copied plain text RFP to clipboard.');
        }
        setTimeout(() => setRfpActionStatus(''), 2500);
    };

    const downloadRfp = () => {
        if (!rfpDraft) return;
        const text = buildRfpPlainText(rfpDraft);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = (input.facilityName?.trim() || input.location || 'facility')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        link.href = url;
        link.download = `janitorial-rfp-${safeName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setRfpActionStatus('Downloaded .txt file.');
        setTimeout(() => setRfpActionStatus(''), 2000);
    };

    const downloadRfpDocx = async () => {
        if (!rfpDraft) return;
        const { Document, Packer, Paragraph, TextRun } = await import('docx');
        const doc = new Document({
            sections: [
                {
                    children: buildRfpPlainText(rfpDraft)
                        .split('\n')
                        .map((line) => new Paragraph({ children: [new TextRun(line)] })),
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = (input.facilityName?.trim() || input.location || 'facility')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        link.href = url;
        link.download = `janitorial-rfp-${safeName}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setRfpActionStatus('Downloaded DOCX.');
        setTimeout(() => setRfpActionStatus(''), 2000);
    };

    const downloadRfpPdf = async () => {
        if (!rfpDraft) return;
        if (!rfpPreviewRef.current) return;
        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(rfpPreviewRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        });
        const doc = new jsPDF({ unit: 'pt', format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 24;
        const contentWidth = pageWidth - margin * 2;
        const contentHeight = pageHeight - margin * 2;
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        let heightLeft = imgHeight;
        let position = margin;
        doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= contentHeight;

        while (heightLeft > 0) {
            doc.addPage();
            position = margin - (imgHeight - heightLeft);
            doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= contentHeight;
        }

        const safeName = (input.facilityName?.trim() || input.location || 'facility')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        doc.save(`janitorial-rfp-${safeName}.pdf`);
        setRfpActionStatus('Downloaded styled PDF.');
        setTimeout(() => setRfpActionStatus(''), 2500);
    };

    const openGmailDraft = () => {
        if (!rfpDraft) return;
        void copyRfpToClipboard({
            includeTitle: false,
            successMessage: 'Copied formatted RFP body (without title) for email.',
        });
        const subject = encodeURIComponent(rfpDraft.title);
        const body = encodeURIComponent(
            'Formatted RFP copied. Paste into this email body (Ctrl/Cmd+V), then attach the PDF before sending.'
        );
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    };

    const openDefaultEmailDraft = () => {
        if (!rfpDraft) return;
        void copyRfpToClipboard({
            includeTitle: false,
            successMessage: 'Copied formatted RFP body (without title) for email.',
        });
        const subject = encodeURIComponent(rfpDraft.title);
        const body = encodeURIComponent(
            'Formatted RFP copied. Paste into this email body (Ctrl/Cmd+V), then attach the PDF before sending.'
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    const buildRfpLeadPayload = (requestedXiri: boolean) => {
        const raw = `${input.facilityName || ''}|${input.picEmail || ''}|${input.zipCode || ''}|${input.location || ''}|${input.estimatedSqft || 0}`;
        const idempotencyKey = `rfp_${raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')}`;
        return {
            source: 'janitorial_rfp_tool' as const,
            idempotencyKey,
            requestedXiri,
            facilityName: input.facilityName?.trim() || undefined,
            facilityType: input.facilityType,
            location: input.location,
            zipCode: input.zipCode?.trim() || '',
            estimatedSqft: input.estimatedSqft,
            serviceWindow: input.serviceWindow,
            transitionDate: input.transitionDate || undefined,
            picName: input.picName?.trim() || '',
            picEmail: input.picEmail?.trim() || '',
            scopeBrief: brief || undefined,
        };
    };

    const submitRfpLeadToXiri = async () => {
        if (!rfpDraft || isSubmittingXiri) return;
        if (!input.picName?.trim()) {
            setRfpActionStatus('Add PIC Name in Step 2 before requesting a bid from XIRI.');
            return;
        }
        if (!input.picEmail?.trim() || !isValidEmail(input.picEmail)) {
            setRfpActionStatus('Add a valid PIC Email in Step 2 before requesting a bid from XIRI.');
            return;
        }
        if (!input.zipCode?.trim() || !isValidUsZip(input.zipCode)) {
            setRfpActionStatus('Add a valid ZIP Code in Step 2 before requesting a bid from XIRI.');
            return;
        }
        setIsSubmittingXiri(true);
        try {
            const functions = getFunctions(app, 'us-central1');
            const submitLeadCallable = httpsCallable<{ payload: ReturnType<typeof buildRfpLeadPayload> }, { success: boolean; deduped?: boolean }>(functions, 'submitRfpLead');
            const result = await submitLeadCallable({ payload: buildRfpLeadPayload(true) });
            if (result.data?.success) {
                setRfpActionStatus(result.data?.deduped ? 'Request already submitted. We will follow up shortly.' : 'Request submitted. XIRI will follow up within one business day.');
            } else {
                setRfpActionStatus('Unable to submit request right now. Please try again.');
            }
        } catch {
            setRfpActionStatus('Unable to submit request right now. Please try again.');
        } finally {
            setIsSubmittingXiri(false);
            setTimeout(() => setRfpActionStatus(''), 3500);
        }
    };

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!showEmailOptions) return;
            const target = event.target as Node;
            if (emailMenuRef.current && !emailMenuRef.current.contains(target)) {
                setShowEmailOptions(false);
            }
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(target)) {
                setShowDownloadOptions(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [showEmailOptions, showDownloadOptions]);

    const updateInput = (key: keyof RfpInput, value: string | number) => {
        setInput((prev) => ({ ...prev, [key]: value }));
    };

    const updateSqft = (raw: string) => {
        const digitsOnly = raw.replace(/[^\d]/g, '');
        if (!digitsOnly) {
            setSqftInput('');
            setInput((prev) => ({ ...prev, estimatedSqft: 0 }));
            return;
        }
        const parsed = Number(digitsOnly);
        setSqftInput(formatWithCommas(parsed));
        setInput((prev) => ({ ...prev, estimatedSqft: parsed }));
    };

    const parseBrief = async () => {
        if (!brief.trim()) return;
        setIsParsing(true);
        try {
            const functions = getFunctions(app, 'us-central1');
            const parseRfpBrief = httpsCallable<{ brief: string }, { parsed?: Partial<RfpInput> }>(functions, 'parseRfpBrief');
            const result = await parseRfpBrief({ brief });
            const parsed = result.data?.parsed;
            if (parsed) {
                setInput((prev) => ({ ...prev, ...parsed }));
                if (typeof parsed.estimatedSqft === 'number' && Number.isFinite(parsed.estimatedSqft)) {
                    setSqftInput(formatWithCommas(parsed.estimatedSqft));
                }
            }
        } catch {
            const fallbackParsed = localParseBrief(brief);
            setInput((prev) => ({ ...prev, ...fallbackParsed }));
            if (typeof fallbackParsed.estimatedSqft === 'number' && Number.isFinite(fallbackParsed.estimatedSqft)) {
                setSqftInput(formatWithCommas(fallbackParsed.estimatedSqft));
            }
        } finally {
            setIsParsing(false);
        }
    };

    const generateRfp = async () => {
        if (!input.facilityName?.trim()) {
            setStep2Error('Facility Name is required.');
            return;
        }
        if (!input.picName?.trim()) {
            setStep2Error('PIC Name is required.');
            return;
        }
        if (!input.picEmail?.trim() || !isValidEmail(input.picEmail)) {
            setStep2Error('Valid PIC Email is required.');
            return;
        }
        if (!input.zipCode?.trim() || !isValidUsZip(input.zipCode)) {
            setStep2Error('Valid US ZIP Code is required.');
            return;
        }
        setStep2Error('');
        setIsGenerating(true);
        try {
            trackEvent('lead_submission_start', {
                source: 'janitorial_rfp_tool',
                facility_type: input.facilityType,
                location: input.location,
            });
            const functions = getFunctions(app, 'us-central1');
            const generateCallable = httpsCallable<{ input: RfpInput }, { draft?: RfpDocument }>(functions, 'generateRfp');
            const result = await generateCallable({ input });
            setRfpDraft(result.data?.draft ?? buildRfpDraft(input));
            setShowRfpPreview(true);
            const submitLeadCallable = httpsCallable<{ payload: ReturnType<typeof buildRfpLeadPayload> }, { success: boolean }>(functions, 'submitRfpLead');
            const leadResult = await submitLeadCallable({ payload: buildRfpLeadPayload(false) });
            if (leadResult.data?.success) {
                trackEvent('lead_submission_success', {
                    source: 'janitorial_rfp_tool',
                    location: input.location,
                    facility_type: input.facilityType,
                });
            } else {
                trackEvent('lead_submission_error', {
                    source: 'janitorial_rfp_tool',
                    error: 'submitRfpLead_returned_unsuccessful',
                });
            }
        } catch {
            setRfpDraft(buildRfpDraft(input));
            setShowRfpPreview(true);
            trackEvent('lead_submission_error', {
                source: 'janitorial_rfp_tool',
                error: 'generate_or_submit_failed',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-6 items-start">
            <section className="bg-white rounded-2xl border border-slate-200 p-6 lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Step 1: Share Your Scope Brief</h2>
                <p className="text-slate-600 mb-4">Share your current scope, pain points, or takeover notes. We pre-fill the RFP draft in seconds.</p>
                <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50">
                    <button
                        type="button"
                        onClick={() => setShowComprehensiveBriefHelp((prev) => !prev)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                        <h3 className="text-sm font-bold text-slate-900">What to include for a comprehensive brief</h3>
                        <span className="text-slate-600 text-sm">{showComprehensiveBriefHelp ? 'Hide' : 'Show'}</span>
                    </button>
                    {showComprehensiveBriefHelp && (
                        <div className="px-4 pb-4">
                            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                                <li>Facility type, location, and approximate square footage.</li>
                                <li>Cleaning schedule and service window (after-hours/day porter/weekend).</li>
                                <li>Current vendor problems you want fixed.</li>
                                <li>Required services, quality standards, and compliance requirements.</li>
                                <li>Target transition date and onboarding expectations.</li>
                            </ul>
                            <p className="text-xs text-slate-500 mt-3">Tip: paste bullet points, not perfect prose.</p>
                        </div>
                    )}
                </div>
                <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="Example: 18,000 sqft multi-tenant medical office in Queens. Current vendor misses restocks and cannot prove service completion..."
                />
                <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Sample lines (click to add)</p>
                    <div className="flex flex-wrap gap-2">
                        {scopePromptSamples.map((sample) => (
                            <button
                                key={sample.label}
                                type="button"
                                onClick={() => {
                                    const line = `${sample.label}: ${sample.detail}`;
                                    setBrief((prev) => (prev.trim() ? `${prev}\n${line}` : line));
                                }}
                                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-sky-400 text-left"
                            >
                                <span className={`mr-2 inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${sample.badgeClass}`}>
                                    {sample.label}
                                </span>
                                <span>{sample.detail}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={parseBrief} disabled={isParsing} className="mt-4 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-semibold disabled:opacity-60">
                    {isParsing ? 'Generating...' : 'Generate From Scope Brief'}
                </button>
            </section>

            <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Step 2: Review & Confirm</h2>
                <p className="text-slate-600 mb-4">Correct what is missing.</p>
                <div className="grid gap-5">
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Facility Name <span className="text-rose-600">*</span></span>
                        <input
                            value={input.facilityName || ''}
                            onChange={(e) => {
                                updateInput('facilityName', e.target.value);
                                if (e.target.value.trim()) setStep2Error('');
                            }}
                            placeholder="Example: Queens Medical Plaza"
                            className={`w-full rounded-xl border px-4 py-3 text-base leading-6 ${step2Error ? 'border-rose-400' : 'border-slate-300'}`}
                        />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Point of Contact Name <span className="text-rose-600">*</span></span>
                        <input
                            value={input.picName || ''}
                            onChange={(e) => updateInput('picName', e.target.value)}
                            placeholder="Example: Jane Smith"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6"
                        />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Point of Contact Email <span className="text-rose-600">*</span></span>
                        <input
                            value={input.picEmail || ''}
                            onChange={(e) => updateInput('picEmail', e.target.value)}
                            placeholder="Example: jane@company.com"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6"
                        />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">ZIP Code <span className="text-rose-600">*</span></span>
                        <input
                            value={input.zipCode || ''}
                            onChange={(e) => updateInput('zipCode', e.target.value)}
                            onBlur={() => {
                                const zipValue = input.zipCode?.trim() || '';
                                if (!zipValue) return;
                                if (isValidUsZip(zipValue)) {
                                    trackEvent('lead_zip_submit', {
                                        source: 'janitorial_rfp_tool',
                                        zip_prefix: zipValue.slice(0, 3),
                                    });
                                } else {
                                    trackEvent('lead_zip_rejected', {
                                        source: 'janitorial_rfp_tool',
                                    });
                                }
                            }}
                            placeholder="Example: 11375"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6"
                        />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Facility Type</span>
                        <input value={input.facilityType} onChange={(e) => updateInput('facilityType', e.target.value)} placeholder="Example: Medical / Clinic" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6" />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Location</span>
                        <input value={input.location} onChange={(e) => updateInput('location', e.target.value)} placeholder="Example: Queens, NY" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6" />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Estimated Square Footage</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={sqftInput}
                            onChange={(e) => updateSqft(e.target.value)}
                            placeholder="Example: 18,000"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6"
                        />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Service Window</span>
                        <input value={input.serviceWindow} onChange={(e) => updateInput('serviceWindow', e.target.value)} placeholder="Example: 6pm-5am" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6" />
                    </label>
                    <label className="text-base text-slate-700">
                        <span className="block mb-1 font-medium">Target Transition Date (Optional)</span>
                        <input value={input.transitionDate || ''} onChange={(e) => updateInput('transitionDate', e.target.value)} placeholder="Example: 2026-06-01" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-6" />
                    </label>
                </div>
                {step2Error && (
                    <p className="mt-3 text-sm text-rose-600 font-medium">{step2Error}</p>
                )}
                <button onClick={generateRfp} disabled={isGenerating} className="mt-4 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-60">
                    {isGenerating ? 'Generating...' : 'Generate RFP'}
                </button>
            </section>

            </div>
            </div>

            {showRfpPreview && rfpDraft && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 p-4 md:p-8">
                    <div className="mx-auto max-w-5xl h-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                            <h2 className="text-lg md:text-xl font-bold text-slate-900">RFP Preview</h2>
                            <button
                                onClick={() => setShowRfpPreview(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            <section className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">{rfpDraft.title}</h2>
                            <p className="text-slate-600">{rfpDraft.summary}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={copyRfpToClipboard} className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700">
                                <Copy className="w-4 h-4 inline-block mr-1.5" />
                                Copy
                            </button>
                            <div className="relative" ref={downloadMenuRef}>
                                <button
                                    onClick={() => setShowDownloadOptions((prev) => !prev)}
                                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                                >
                                    <Download className="w-4 h-4 inline-block mr-1.5" />
                                    Download File
                                </button>
                                {showDownloadOptions && (
                                    <div className="absolute left-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-20 p-1">
                                        <button
                                            onClick={() => {
                                                downloadRfpPdf();
                                                setShowDownloadOptions(false);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                            PDF
                                        </button>
                                        <button
                                            onClick={() => {
                                                void downloadRfpDocx();
                                                setShowDownloadOptions(false);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                            DOCX
                                        </button>
                                        <button
                                            onClick={() => {
                                                downloadRfp();
                                                setShowDownloadOptions(false);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                            TXT
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="relative" ref={emailMenuRef}>
                                <button
                                    onClick={() => setShowEmailOptions((prev) => !prev)}
                                    className="px-3 py-2 rounded-lg bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700"
                                >
                                    <Mail className="w-4 h-4 inline-block mr-1.5" />
                                    Choose Email Client
                                </button>
                                {showEmailOptions && (
                                    <div className="absolute left-0 mt-2 w-52 rounded-lg border border-slate-200 bg-white shadow-lg z-20 p-1">
                                        <button
                                            onClick={() => {
                                                openGmailDraft();
                                                setShowEmailOptions(false);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <img src="/icons/gmail-logo.svg" alt="Gmail" className="w-5 h-5" />
                                                Gmail
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                openDefaultEmailDraft();
                                                setShowEmailOptions(false);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <img src="/icons/email-client.svg" alt="Default email app" className="w-5 h-5" />
                                                Default Email App
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={submitRfpLeadToXiri}
                                disabled={isSubmittingXiri}
                                className="px-3 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                <Send className="w-4 h-4 inline-block mr-1.5" />
                                {isSubmittingXiri ? 'Submitting...' : 'Request Bid from XIRI Facility Solutions'}
                            </button>
                        </div>
                    </div>
                    <div ref={rfpPreviewRef}>
                    {rfpActionStatus && (
                        <p className="text-sm text-emerald-700 mb-3">{rfpActionStatus}</p>
                    )}
                    <div className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-bold text-slate-900">RFP Overview</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Use this document to request comparable janitorial bids with clear scope, standards, and transition expectations.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left px-4 py-3 bg-slate-50 text-slate-700 font-semibold w-56">Facility Name</th>
                                        <td className="px-4 py-3 text-slate-900">{input.facilityName?.trim() || 'Not specified'}</td>
                                    </tr>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left px-4 py-3 bg-slate-50 text-slate-700 font-semibold">Facility Type</th>
                                        <td className="px-4 py-3 text-slate-900">{input.facilityType}</td>
                                    </tr>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left px-4 py-3 bg-slate-50 text-slate-700 font-semibold">Location</th>
                                        <td className="px-4 py-3 text-slate-900">{input.location}</td>
                                    </tr>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left px-4 py-3 bg-slate-50 text-slate-700 font-semibold">Estimated Square Footage</th>
                                        <td className="px-4 py-3 text-slate-900">{formatWithCommas(input.estimatedSqft)} sqft</td>
                                    </tr>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left px-4 py-3 bg-slate-50 text-slate-700 font-semibold">Service Window</th>
                                        <td className="px-4 py-3 text-slate-900">{input.serviceWindow}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left px-4 py-3 bg-slate-50 text-slate-700 font-semibold">Target Transition Date</th>
                                        <td className="px-4 py-3 text-slate-900">{input.transitionDate || 'TBD'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-bold text-slate-900">How to Submit a Proposal</h3>
                        </div>
                        <div className="p-4">
                            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                                <p><span className="font-semibold">Submit to:</span> {input.picEmail?.trim() || 'TBD'}</p>
                                <p><span className="font-semibold">Attention:</span> {input.picName?.trim() || 'TBD'}</p>
                                <p><span className="font-semibold">Subject format:</span> RFP Response - {input.facilityName?.trim() || 'Facility'} - [Vendor Name]</p>
                                <p><span className="font-semibold">Due date:</span> {input.transitionDate || 'TBD'}</p>
                            </div>
                            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
                                <li>Confirm your bid covers all required services and frequencies listed in this RFP.</li>
                                <li>Include a monthly price, staffing plan, QA/reporting cadence, and compliance documentation.</li>
                                <li>Provide a transition plan with start date, onboarding timeline, and escalation contacts.</li>
                                <li>Clearly list any exclusions or assumptions so comparisons are apples-to-apples.</li>
                            </ol>
                            <div className="mt-3 text-sm text-slate-700">
                                <p className="font-semibold mb-1">Required attachments:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Insurance COI</li>
                                    <li>Business license/entity documentation</li>
                                    <li>Sample QA report</li>
                                    <li>Transition plan timeline</li>
                                    <li>References/case studies</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h4 className="font-semibold text-slate-900 mb-2">Required Services</h4>
                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                                {(parseBulletItems(getSectionById('required-services')?.body || '')).map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h4 className="font-semibold text-slate-900 mb-2">Compliance & SLA Priorities</h4>
                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                                {(parseBulletItems(getSectionById('compliance-sla')?.body || '')).slice(0, 8).map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rfpDraft.sections
                            .filter((section) => section.id !== 'scope-overview')
                            .map((section, index) => (
                            <div key={section.id} className="rounded-xl border border-slate-200 p-4 bg-white">
                                <h3 className="font-bold text-slate-900 mb-2">{index + 1}. {section.title}</h3>
                                {renderSectionBody(section.body)}
                            </div>
                        ))}
                    </div>
                    </div>
                </section>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
