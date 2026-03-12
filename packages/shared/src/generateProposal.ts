/**
 * generateProposal.ts
 * Professional cleaning proposal PDF generator.
 * Creates a print-ready, multi-page proposal document using jsPDF.
 *
 * Layout:
 *   1. Cover Page
 *   2. Property Overview + Service Investment
 *   3-4. Job Specifications (area-based task tables)
 *   5. Terms & Conditions + Signature Block
 *   6. (Optional) COI image
 *   7. (Optional) Professional References
 *
 * EXCLUDES all internal cost data (profit %, payroll tax %, labor breakdown).
 */
import jsPDF from "jspdf";
import { BUILDING_TYPES, CLEANING_TASKS, FREQUENCIES, TASK_CATEGORIES, ROOM_TYPES, TASK_FREQUENCY_OPTIONS } from "./calculator";
import type { CalculatorInputs, CalculatorResults, RoomScope } from "./calculator";

export interface ProposalTerms {
    legalName: string;
    employeeStatus: string;
    supervisionApproach: string;
    companyPhilosophy: string;
    cancellationPolicy: string;
    serviceGuarantee: string;
    lateFeePolicy: string;
    equipmentDescription: string;
    specialServices: string;
    suppliesPolicy: string;
    suppliesWeProvide: string;
    suppliesCustomerProvides: string;
    contractTerm: string;
    additionalTerms: string;
    bonded: boolean;
    bondAmount: string;
    uniformedPersonnel: boolean;
}


export interface ProposalReference {
    companyName: string;
    contactName: string;
    phone?: string;
    email?: string;
}

export interface ProposalData {
    bidName: string;
    companyName: string;
    contactName: string;
    contactCompany: string;
    contactEmail?: string;
    contactPhone?: string;
    contactAddress?: string;
    state: string;
    inputs: CalculatorInputs;
    results: CalculatorResults;
    selectedTasks: string[];
    version: number;
    createdAt: string;

    // Company info from Firebase company doc
    companyPhone?: string;
    companyEmail?: string;
    companyAddress?: string;
    companyLogoUrl?: string;

    // Optional trust signals
    coiImageDataUrl?: string;
    references?: ProposalReference[];

    // Optional content
    coverLetterText?: string;
    specialNotes?: string;

    // Proposal terms from company defaults (per-bid customizable)
    proposalTerms?: ProposalTerms;

    // Room-based scope
    roomScopes?: RoomScope[];
    priceOverride?: number | null;
    watermark?: string;  // e.g. "DRAFT" — rendered diagonally on every page
}

/* ─── Print-Friendly Color Palette ─── */
const C = {
    black: [26, 26, 46] as [number, number, number],        // #1a1a2e
    body: [55, 65, 81] as [number, number, number],          // #374151
    muted: [107, 114, 128] as [number, number, number],      // #6b7280
    light: [156, 163, 175] as [number, number, number],      // #9ca3af
    line: [229, 231, 235] as [number, number, number],       // #e5e7eb
    lineDark: [209, 213, 219] as [number, number, number],   // #d1d5db
    accent: [0, 180, 150] as [number, number, number],       // #00b496 (slightly deeper for print)
    white: [255, 255, 255] as [number, number, number],
    bgLight: [249, 250, 251] as [number, number, number],    // #f9fafb
};

/* ─── Page Constants (US Letter) ─── */
const PAGE_W = 215.9;  // 8.5 in in mm
const PAGE_H = 279.4;  // 11 in in mm
const MARGIN = 25.4;   // 1 inch margins
const CONTENT_W = PAGE_W - MARGIN * 2;

const fmt = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateProposal(data: ProposalData) {
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    let y = 0;

    // Pre-load company logo if available
    let logoDataUrl: string | null = null;
    if (data.companyLogoUrl) {
        try {
            const resp = await fetch(data.companyLogoUrl);
            const blob = await resp.blob();
            logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.warn("Could not load company logo:", err);
        }
    }

    const dateStr = new Date(data.createdAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
    });

    // ─── Helpers ───
    const checkPage = (needed: number) => {
        if (y + needed > PAGE_H - 30) {
            doc.addPage();
            y = MARGIN;
        }
    };

    const hr = (yPos: number, color = C.line) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
    };

    const accentLine = (yPos: number, width = CONTENT_W) => {
        doc.setDrawColor(...C.accent);
        doc.setLineWidth(1);
        doc.line(MARGIN, yPos, MARGIN + width, yPos);
    };

    const sectionTitle = (title: string) => {
        checkPage(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...C.black);
        doc.text(title, MARGIN, y);
        y += 2;
        accentLine(y, 40);
        y += 8;
    };

    const labelValue = (label: string, value: string, x: number, yPos: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.text(label.toUpperCase(), x, yPos);
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.body);
        doc.text(value, x, yPos + 5);
    };

    // ═══════════════════════════════════════════════════════════
    //  PAGE 1 — COVER PAGE
    // ═══════════════════════════════════════════════════════════

    // Logo (if uploaded)
    y = 45;
    if (logoDataUrl) {
        try {
            const logoH = 30;
            const logoW = 50;
            doc.addImage(logoDataUrl, "PNG", (PAGE_W - logoW) / 2, y, logoW, logoH);
            y += logoH + 8;
        } catch {
            y = 60;
        }
    } else {
        y = 60;
    }

    // Company name — large, top area
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...C.black);
    doc.text(data.companyName, PAGE_W / 2, y, { align: "center" });

    // Accent line under company name
    y += 6;
    const nameWidth = doc.getTextWidth(data.companyName);
    const lineStart = (PAGE_W - Math.min(nameWidth, 120)) / 2;
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(1.2);
    doc.line(lineStart, y, lineStart + Math.min(nameWidth, 120), y);

    // Subtitle
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(...C.muted);
    doc.text("Professional Cleaning Services Proposal", PAGE_W / 2, y, { align: "center" });

    // ─── Prepared For / Prepared By blocks ───
    y = 140;

    // Prepared For
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("PREPARED FOR", MARGIN, y);

    y += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...C.black);
    doc.text(data.contactName, MARGIN, y);
    y += 6;

    if (data.contactCompany) {
        doc.setFontSize(10);
        doc.setTextColor(...C.body);
        doc.text(data.contactCompany, MARGIN, y);
        y += 5;
    }
    if (data.contactAddress) {
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(data.contactAddress, MARGIN, y);
        y += 5;
    }
    if (data.contactEmail) {
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(data.contactEmail, MARGIN, y);
        y += 5;
    }
    if (data.contactPhone) {
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(data.contactPhone, MARGIN, y);
        y += 5;
    }

    // Prepared By — right side
    const rightX = PAGE_W / 2 + 10;
    let ry = 140;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("PREPARED BY", rightX, ry);

    ry += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...C.black);
    doc.text(data.companyName, rightX, ry);
    ry += 6;

    if (data.companyAddress) {
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(data.companyAddress, rightX, ry);
        ry += 5;
    }
    if (data.companyEmail) {
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(data.companyEmail, rightX, ry);
        ry += 5;
    }
    if (data.companyPhone) {
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(data.companyPhone, rightX, ry);
        ry += 5;
    }

    // Date + version at bottom
    const coverBottomY = PAGE_H - 50;
    hr(coverBottomY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(dateStr, MARGIN, coverBottomY + 8);
    doc.text(`Version ${data.version}`, PAGE_W - MARGIN, coverBottomY + 8, { align: "right" });

    // ═══════════════════════════════════════════════════════════
    //  PAGE 2 — PROPERTY OVERVIEW + SERVICE INVESTMENT
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    y = MARGIN;

    sectionTitle("Property Overview");

    const buildingType = BUILDING_TYPES.find(b => b.id === data.inputs.buildingTypeId);
    const frequency = FREQUENCIES.find(f => f.value === data.inputs.frequency);

    const details = [
        { label: "Building Type", value: buildingType?.name || "-" },
        { label: "Square Footage", value: `${data.inputs.sqft.toLocaleString()} sq ft` },
        { label: "Cleaning Frequency", value: frequency?.label || "-" },
        { label: "Location", value: data.state || "-" },
    ];

    // 2-column grid
    const colW = CONTENT_W / 2;
    details.forEach((d, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        labelValue(d.label, d.value, MARGIN + col * colW, y + row * 16);
    });
    y += Math.ceil(details.length / 2) * 16 + 8;

    hr(y);
    y += 15;

    // ─── Service Investment ───
    sectionTitle("Service Investment");

    // Monthly price — large and prominent
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(...C.accent);
    const displayPrice = data.priceOverride ?? data.results.totalPricePerMonth;
    const monthlyPrice = fmt(displayPrice);
    doc.text(monthlyPrice, MARGIN, y + 4);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.muted);
    doc.text("per month", MARGIN, y + 4);

    // Show override note if applicable
    if (data.priceOverride != null) {
        y += 8;
        doc.setFont("times", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(...C.muted);
        doc.text(`Calculator estimate: ${fmt(data.results.totalPricePerMonth)} — final price set by provider`, MARGIN, y + 4);
    }

    y += 14;

    // Secondary stats in a row
    const stats = [
        { label: "Per Visit", value: fmt(data.results.pricePerVisit) },
        { label: "Per Sq Ft", value: `$${data.results.pricePerSqft.toFixed(3)}` },
        { label: "Visits / Month", value: String(data.results.visitsPerMonth) },
    ];

    const statColW = CONTENT_W / 3;
    stats.forEach((s, i) => {
        const sx = MARGIN + statColW * i;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.text(s.label.toUpperCase(), sx, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...C.black);
        doc.text(s.value, sx, y + 6);
    });

    y += 20;
    hr(y);
    y += 15;

    // ─── Additional notes (if provided) ───
    if (data.specialNotes) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text("ADDITIONAL NOTES", MARGIN, y);
        y += 6;
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.body);
        const noteLines = doc.splitTextToSize(data.specialNotes, CONTENT_W);
        doc.text(noteLines, MARGIN, y);
        y += noteLines.length * 4.5 + 8;
    }

    // ═══════════════════════════════════════════════════════════
    //  PAGES 3-4 — JOB SPECIFICATIONS
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    y = MARGIN;

    sectionTitle("Job Specifications");

    // Frequency context line
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...C.body);
    doc.text(
        `The following services will be performed at the above location.`,
        MARGIN, y
    );
    y += 10;

    const selectedTaskObjects = CLEANING_TASKS.filter(t => data.selectedTasks.includes(t.id));

    // Derive "service days" text from a frequency value
    const freqToLabel = (freq: string): string => {
        const opt = TASK_FREQUENCY_OPTIONS.find(o => o.value === freq);
        if (opt) return opt.label;
        const n = parseFloat(freq);
        if (n >= 1) return `${n} days/wk.`;
        if (n === 0.5) return "2x/mo.";
        if (n === 0.25) return "1x/mo.";
        return "As needed";
    };
    const getServiceDays = (task: typeof CLEANING_TASKS[0], freqOverride?: string): string => {
        if (freqOverride) return freqToLabel(freqOverride);
        // Specialty/periodic tasks are shown as monthly regardless
        if (task.category === "specialty") return "Monthly";
        // Regular tasks follow the bid frequency
        return freqToLabel(data.inputs.frequency);
    };

    // Table layout constants
    const TABLE_LEFT = MARGIN;
    const SERVICE_DAYS_W = 35;
    const TASK_DESC_W = CONTENT_W - SERVICE_DAYS_W;

    // ─── Render by room or by category ───
    if (data.roomScopes && data.roomScopes.length > 0) {
        // Room-Based Rendering
        for (const room of data.roomScopes) {
            const roomType = ROOM_TYPES.find(r => r.id === room.roomTypeId);
            const roomName = roomType?.name || room.customName || "Area";
            const roomTasks = CLEANING_TASKS.filter(t => room.tasks.includes(t.id));
            const customTasks = room.customTasks || [];
            if (roomTasks.length === 0 && customTasks.length === 0) continue;

            checkPage(18);

            // Room header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...C.black);
            doc.text(`${roomName}`, TABLE_LEFT, y);
            y += 4.5;

            // Table header row
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text("TASK", TABLE_LEFT + 2, y);
            doc.text("FREQUENCY", TABLE_LEFT + TASK_DESC_W, y, { align: "left" });
            y += 1;
            hr(y, C.lineDark);
            y += 3.5;

            // Preset tasks (with override support)
            for (const task of roomTasks) {
                checkPage(8);

                doc.setFont("times", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.body);

                const taskName = room.taskOverrides?.[task.id]?.name || task.description;
                const descLines = doc.splitTextToSize(taskName, TASK_DESC_W - 8);
                doc.text(descLines, TABLE_LEFT + 2, y);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...C.muted);
                doc.text(getServiceDays(task, room.taskFrequencies?.[task.id]), TABLE_LEFT + TASK_DESC_W, y);

                const rowH = Math.max(descLines.length * 3.5, 4);
                y += rowH + 2;

                doc.setDrawColor(...C.line);
                doc.setLineWidth(0.1);
                doc.line(TABLE_LEFT, y, TABLE_LEFT + CONTENT_W, y);
                y += 4;
            }

            // Custom tasks
            for (const ct of customTasks) {
                checkPage(8);

                doc.setFont("times", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.body);

                const descLines = doc.splitTextToSize(ct.name, TASK_DESC_W - 8);
                doc.text(descLines, TABLE_LEFT + 2, y);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...C.muted);
                doc.text(ct.frequency ? freqToLabel(ct.frequency) : "As needed", TABLE_LEFT + TASK_DESC_W, y);

                const rowH = Math.max(descLines.length * 3.5, 4);
                y += rowH + 2;

                doc.setDrawColor(...C.line);
                doc.setLineWidth(0.1);
                doc.line(TABLE_LEFT, y, TABLE_LEFT + CONTENT_W, y);
                y += 4;
            }

            y += 3;
        }
    } else {
        // Legacy: Category-based rendering
        for (const cat of TASK_CATEGORIES) {
            const catTasks = selectedTaskObjects.filter(t => t.category === cat.id);
            if (catTasks.length === 0) continue;

            checkPage(18);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...C.black);
            doc.text(cat.label, TABLE_LEFT, y);
            y += 4.5;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text("TASK", TABLE_LEFT + 2, y);
            doc.text("FREQUENCY", TABLE_LEFT + TASK_DESC_W, y, { align: "left" });
            y += 1;
            hr(y, C.lineDark);
            y += 3.5;

            for (const task of catTasks) {
                checkPage(8);

                doc.setFont("times", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.body);

                const descLines = doc.splitTextToSize(task.description, TASK_DESC_W - 8);
                doc.text(descLines, TABLE_LEFT + 2, y);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...C.muted);
                doc.text(getServiceDays(task), TABLE_LEFT + TASK_DESC_W, y);

                const rowH = Math.max(descLines.length * 3.5, 4);
                y += rowH + 2;

                doc.setDrawColor(...C.line);
                doc.setLineWidth(0.1);
                doc.line(TABLE_LEFT, y, TABLE_LEFT + CONTENT_W, y);
                y += 4;
            }

            y += 3;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  TERMS & CONDITIONS + SIGNATURE BLOCK
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    y = MARGIN;

    sectionTitle("Terms and Conditions");

    const pt = data.proposalTerms;
    const terms: string[] = [];

    // Supplies
    if (pt?.suppliesPolicy === "we_provide") {
        terms.push("All cleaning supplies and consumables necessary to perform the services described herein will be provided by the service provider.");
    } else if (pt?.suppliesPolicy === "customer_provides") {
        terms.push("The client shall provide all cleaning supplies and consumables. The service provider will furnish all necessary equipment.");
    } else if (pt?.suppliesPolicy === "both") {
        const wePart = pt.suppliesWeProvide ? ` Service provider supplies: ${pt.suppliesWeProvide}.` : "";
        const custPart = pt.suppliesCustomerProvides ? ` Client supplies: ${pt.suppliesCustomerProvides}.` : "";
        terms.push(`Cleaning supplies and consumables are shared between the service provider and the client.${wePart}${custPart}`);
    } else {
        terms.push("All labor, cleaning supplies, and equipment necessary to perform the services described herein will be provided by the service provider.");
    }

    terms.push("Services will be performed on the schedule outlined in the Job Specifications section of this proposal.");

    // Payment / late fee
    if (pt?.lateFeePolicy) {
        terms.push(`Payment terms: ${pt.lateFeePolicy}`);
    } else {
        terms.push("Payment is due within thirty (30) days of the invoice date (Net-30 terms).");
    }

    terms.push("This proposal is valid for thirty (30) days from the date on the cover page.");

    // Cancellation
    if (pt?.cancellationPolicy) {
        terms.push(`Cancellation: ${pt.cancellationPolicy}`);
    } else {
        terms.push("Either party may terminate this agreement with thirty (30) days written notice.");
    }

    terms.push("Pricing may be adjusted annually based on changes in labor market conditions, with written notice provided at least sixty (60) days in advance.");

    // Insurance / bonded
    if (pt?.bonded && pt.bondAmount) {
        terms.push(`The service provider maintains general liability insurance, workers compensation coverage, and is bonded for up to ${pt.bondAmount}. A Certificate of Insurance (COI) will be provided upon request.`);
    } else {
        terms.push("The service provider maintains general liability insurance and workers compensation coverage. A Certificate of Insurance (COI) will be provided upon request.");
    }

    // Service guarantee
    if (pt?.serviceGuarantee) {
        terms.push(`Service guarantee: ${pt.serviceGuarantee}`);
    }

    // Additional terms
    if (pt?.additionalTerms) {
        terms.push(pt.additionalTerms);
    }

    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.body);

    terms.forEach((term, i) => {
        checkPage(14);
        const termLines = doc.splitTextToSize(`${i + 1}.  ${term}`, CONTENT_W);
        doc.text(termLines, MARGIN, y);
        y += termLines.length * 4 + 3;
    });

    y += 10;
    hr(y);
    y += 15;

    // ─── Signature Block ───
    checkPage(60);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("ACCEPTANCE", MARGIN, y);
    y += 3;
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.body);
    doc.text(
        "By signing below, both parties agree to the terms and conditions outlined in this proposal.",
        MARGIN, y
    );
    y += 12;

    const sigColW = (CONTENT_W - 15) / 2;

    // Left column — Client
    const drawSigBlock = (title: string, xStart: number) => {
        const sigY = y;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...C.black);
        doc.text(title, xStart, sigY);

        const lineLen = sigColW - 5;
        const fields = ["Signature", "Printed Name", "Title", "Date"];
        fields.forEach((field, i) => {
            const fy = sigY + 14 + i * 14;
            // Line
            doc.setDrawColor(...C.lineDark);
            doc.setLineWidth(0.4);
            doc.line(xStart, fy, xStart + lineLen, fy);
            // Label
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...C.muted);
            doc.text(field, xStart, fy + 4);
        });
    };

    drawSigBlock("Accepted By (Client)", MARGIN);
    const sigLabel = pt?.legalName ? `Authorized By (${pt.legalName})` : "Authorized By (Service Provider)";
    drawSigBlock(sigLabel, MARGIN + sigColW + 15);
    y += 75;

    // ═══════════════════════════════════════════════════════════
    //  OPTIONAL: COI IMAGE
    // ═══════════════════════════════════════════════════════════
    if (data.coiImageDataUrl) {
        doc.addPage();
        y = MARGIN;

        sectionTitle("Certificate of Insurance");

        try {
            // Fit image within content area, preserving aspect ratio
            const imgW = CONTENT_W;
            const imgH = PAGE_H - MARGIN * 2 - 20; // Leave room for title
            doc.addImage(data.coiImageDataUrl, "JPEG", MARGIN, y, imgW, imgH);
        } catch (err) {
            doc.setFont("times", "italic");
            doc.setFontSize(10);
            doc.setTextColor(...C.muted);
            doc.text("Certificate of Insurance available upon request.", MARGIN, y);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  OPTIONAL: PROFESSIONAL REFERENCES
    // ═══════════════════════════════════════════════════════════
    if (data.references && data.references.length > 0) {
        doc.addPage();
        y = MARGIN;

        sectionTitle("Professional References");

        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.body);
        doc.text(
            "We are proud to serve the following clients and invite you to contact them regarding our services.",
            MARGIN, y
        );
        y += 10;

        data.references.forEach((ref, i) => {
            checkPage(22);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...C.black);
            doc.text(ref.companyName, MARGIN, y);
            y += 5;

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(...C.body);
            doc.text(`Contact: ${ref.contactName}`, MARGIN + 2, y);
            y += 4.5;

            if (ref.phone) {
                doc.setTextColor(...C.muted);
                doc.text(`Phone: ${ref.phone}`, MARGIN + 2, y);
                y += 4.5;
            }
            if (ref.email) {
                doc.setTextColor(...C.muted);
                doc.text(`Email: ${ref.email}`, MARGIN + 2, y);
                y += 4.5;
            }

            y += 4;

            // Divider between references
            if (i < data.references!.length - 1) {
                hr(y);
                y += 6;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  FOOTER — ALL PAGES
    // ═══════════════════════════════════════════════════════════
    const footerY = PAGE_H - 15;
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, footerY - 4, PAGE_W - MARGIN, footerY - 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(`${data.companyName}`, MARGIN, footerY);
        doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, footerY, { align: "right" });

        // Watermark
        if (data.watermark) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(72);
            doc.setTextColor(220, 220, 220);
            doc.text(data.watermark, PAGE_W / 2, PAGE_H / 2, {
                align: "center",
                angle: 45,
            });
        }
    }

    // ─── Return doc + filename ───
    const filename = `Proposal - ${data.bidName} - ${data.contactCompany || data.contactName} - ${dateStr}.pdf`;
    return { doc, filename };
}
