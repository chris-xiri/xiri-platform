// ── Solutions Data ──
// Extracted from app/solutions/[slug]/page.tsx for separation of concerns.

export interface SolutionData {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    problemTitle: string;
    problemPoints: string[];
    solutionTitle: string;
    solutionPoints: { title: string; description: string }[];
    relevantServices: string[];
    faqs: { question: string; answer: string }[];
    comparisonTable?: { category: string; diy: string; software: string; xiri: string }[];
}

export // ── Solutions Data ──
const SOLUTIONS: Record<string, {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    problemTitle: string;
    problemPoints: string[];
    solutionTitle: string;
    solutionPoints: { title: string; description: string }[];
    relevantServices: string[];
    faqs: { question: string; answer: string }[];
    comparisonTable?: { category: string; diy: string; software: string; xiri: string }[];
}> = {
    'medical-facility-management': {
        title: 'Medical Facility Management',
        heroTitle: 'Facility Management Built for Medical Practices',
        heroSubtitle: 'JCAHO-compliant cleaning, documented audits, and one invoice — so you can focus on patient care, not janitorial logistics.',
        metaDescription: 'Professional facility management for medical offices, urgent care centers, and surgery centers. JCAHO-compliant cleaning with nightly audits and one consolidated invoice.',
        problemTitle: 'The Hidden Cost of "Managing It Yourself"',
        problemPoints: [
            'Your office manager spends 5+ hours/week coordinating vendors, chasing invoices, and handling complaints',
            'Missed cleans go unnoticed until a patient or surveyor notices — putting your accreditation at risk',
            'Generic cleaning companies don\'t understand bloodborne pathogen protocols or terminal cleaning standards',
            'Multiple vendors mean multiple invoices, multiple insurance certificates to track, and multiple points of failure',
            'When a vendor no-shows, you\'re scrambling to find a replacement while patients walk into a dirty facility',
        ],
        solutionTitle: 'How XIRI Solves It',
        solutionPoints: [
            {
                title: 'One Point of Contact',
                description: 'Your dedicated Facility Solutions Manager handles everything — vendor coordination, scheduling, complaints, and compliance documentation. You make one call, ever.',
            },
            {
                title: 'Nightly Audits, Not Promises',
                description: 'Our Night Managers physically verify every clean in your facility. You get photographic proof every morning — not just a contractor\'s word.',
            },
            {
                title: 'JCAHO & OSHA Compliance Built In',
                description: 'We maintain digital cleaning logs, chemical SDS sheets, and audit documentation that\'s ready for your next accreditation survey or state inspection.',
            },
            {
                title: 'One Invoice, Every Service',
                description: 'Janitorial, floor care, pest control, waste management, HVAC filters — all consolidated into one monthly invoice with transparent line items.',
            },
        ],
        relevantServices: ['medical-office-cleaning', 'urgent-care-cleaning', 'surgery-center-cleaning', 'disinfecting-services', 'floor-care', 'waste-management'],
        faqs: [
            {
                question: 'How is XIRI different from hiring a cleaning company directly?',
                answer: 'A cleaning company sends a crew. XIRI sends a crew, a Night Manager who audits their work, and a dedicated FSM who manages everything. We verify quality independently — the auditor is never the cleaner.',
            },
            {
                question: 'Can you handle a multi-location medical practice?',
                answer: 'Yes. We manage multi-site medical groups with coordinated cleaning schedules, standardized quality metrics, and one consolidated invoice across all locations.',
            },
            {
                question: 'What happens if we have a compliance survey tomorrow?',
                answer: 'Because our Night Managers audit nightly with photographic documentation, your facility is always survey-ready. We can pull 12 months of cleaning logs, chemical records, and audit photos within minutes.',
            },
            {
                question: 'How quickly can you start service?',
                answer: 'From initial site audit to first clean is typically 5–7 business days. Emergency start for facilities with urgent needs can be coordinated in as little as 48 hours.',
            },
        ],
    },
    'single-tenant-maintenance': {
        title: 'Single-Tenant Building Maintenance',
        heroTitle: 'Stop Juggling Vendors for Your Building',
        heroSubtitle: 'If you\'re a single-tenant occupier responsible for your own building maintenance, you need a system — not another spreadsheet.',
        metaDescription: 'Complete building maintenance for single-tenant NNN lease occupiers. One vendor, one invoice, and one point of contact for janitorial, HVAC, snow removal, and everything between the roof and floor.',
        problemTitle: 'The NNN Tenant\'s Nightmare',
        problemPoints: [
            'Triple-net lease means you\'re responsible for everything — but you\'re not a property manager, you\'re a business owner',
            'You have 4–7 different vendors for cleaning, snow, HVAC, pest control, and handyman — and none of them talk to each other',
            'Tracking insurance certificates, scheduling, and invoices for each vendor consumes your admin staff\'s time',
            'When a vendor doesn\'t show up, nobody notices until Monday morning — and now it\'s your problem',
            'You\'re paying retail for each service because no single vendor manages enough of your building to give you leverage',
        ],
        solutionTitle: 'One Call Covers Your Entire Building',
        solutionPoints: [
            {
                title: 'Roof to Floor Coverage',
                description: 'Janitorial, floor care, windows, HVAC filters, pest control, snow removal, parking lot maintenance, handyman — all managed under one agreement.',
            },
            {
                title: 'Your FSM Is Your Building Manager',
                description: 'Your dedicated Facility Solutions Manager handles all vendor coordination, scheduling, quality control, and issue resolution. Weekly site visits ensure nothing slips.',
            },
            {
                title: 'One Invoice, Zero Surprises',
                description: 'Every service consolidated into one predictable monthly invoice. No more tracking 7 vendors, 7 insurance certs, and 7 payment schedules.',
            },
            {
                title: 'Verified Quality',
                description: 'NFC proof of work, zone-level task checklists, and nightly photographic audits by our Night Managers. You never wonder if the cleaning crew actually showed up — you have proof.',
            },
        ],
        relevantServices: ['janitorial-services', 'floor-care', 'window-cleaning', 'hvac-maintenance', 'pest-control', 'snow-ice-removal', 'parking-lot-maintenance', 'handyman-services'],
        faqs: [
            {
                question: 'What is a triple-net (NNN) lease and why does it matter for maintenance?',
                answer: 'In a NNN lease, the tenant is responsible for all building operating expenses including maintenance, insurance, and taxes — not the landlord. That means you need to source and manage every vendor yourself, or partner with XIRI to handle it all.',
            },
            {
                question: 'We\'re a small business — can we afford this?',
                answer: 'Most clients find that consolidating vendors through XIRI actually reduces total cost. You eliminate redundant service visits, get volume pricing across services, and reclaim the admin hours your staff spends chasing vendors.',
            },
            {
                question: 'How does pricing work?',
                answer: 'We build a custom scope based on your facility size, service needs, and frequency. You get one flat monthly rate that covers all included services — no hourly billing, no surprise charges, no per-incident fees.',
            },
            {
                question: 'Can we start with just cleaning and add services later?',
                answer: 'Absolutely. Most clients start with janitorial as the foundation and add floor care, pest control, HVAC, and seasonal services over time. Your FSM recommends additions based on what they observe during weekly site visits.',
            },
        ],
    },
    'vendor-management-alternative': {
        title: 'The Vendor Management Alternative',
        heroTitle: 'Stop Managing Vendors. Start Managing Results.',
        heroSubtitle: 'You don\'t need vendor management software. You need someone to manage the vendors for you.',
        metaDescription: 'Tired of spreadsheets and software to manage cleaning and maintenance vendors? XIRI replaces vendor management tools with actual vendor management — one contact, one invoice, verified quality.',
        problemTitle: 'Software Can\'t Fix a People Problem',
        problemPoints: [
            'You tried spreadsheets — tracking 5+ vendors, their schedules, insurance expiration dates, and invoices across tabs that nobody updates',
            'You looked at CMMS or FM software — $200–500/month tools that still require you to find, vet, and manage every vendor yourself',
            'The software shows you what\'s broken. It doesn\'t fix it. You still make the calls, chase the quotes, and follow up on no-shows',
            'Your admin staff spends 8–10 hours/week on vendor coordination that isn\'t their actual job',
            'When quality drops, software can\'t walk your building at midnight to verify the cleaning was actually done',
        ],
        solutionTitle: 'We Replace the Software AND the Work',
        solutionPoints: [
            {
                title: 'We Find & Vet the Vendors',
                description: 'You don\'t source contractors. We recruit, background-check, verify insurance, and match the right vendor to your facility. You approve — we do the legwork.',
            },
            {
                title: 'We Manage the Schedule',
                description: 'No more tracking who comes on which night. Your FSM builds the schedule, coordinates all vendors, and handles any no-shows or substitutions automatically.',
            },
            {
                title: 'We Verify the Quality',
                description: 'Software can\'t walk your building at midnight. Our Night Managers physically audit every clean with NFC proof of work technology and submit photographic proof before morning.',
            },
            {
                title: 'We Send One Invoice',
                description: 'Stop reconciling 5 vendor invoices every month. One XIRI invoice covers everything — janitorial, floor care, pest, snow, HVAC, and more.',
            },
        ],
        relevantServices: ['janitorial-services', 'commercial-cleaning', 'floor-care', 'window-cleaning', 'pest-control', 'hvac-maintenance'],
        comparisonTable: [
            { category: 'Monthly Cost', diy: 'Your staff\'s time', software: '$200–$500/mo + vendor costs', xiri: 'One flat monthly invoice' },
            { category: 'Vendor Sourcing', diy: 'You do it', software: 'You do it', xiri: 'We do it' },
            { category: 'Insurance Tracking', diy: 'You track it', software: 'You upload it', xiri: 'We verify it' },
            { category: 'Quality Verification', diy: 'Hope for the best', software: 'Self-reported checklists', xiri: 'Night Manager audits nightly' },
            { category: 'No-Show Coverage', diy: 'You scramble', software: 'Alerts you', xiri: 'Auto-dispatches backup' },
            { category: 'Single Invoice', diy: '5–7 separate bills', software: 'Still 5–7 bills', xiri: 'One invoice, all services' },
        ],
        faqs: [
            {
                question: 'How is XIRI different from facility management software?',
                answer: 'Software gives you tools to manage vendors yourself. XIRI actually manages the vendors for you. We source them, schedule them, audit their work nightly, and consolidate everything into one invoice. You get the result without the work.',
            },
            {
                question: 'What if I already have vendors I want to keep?',
                answer: 'We can work with your existing vendors or replace them — your choice. If you want to keep a vendor you trust, we simply add them to our management and auditing system.',
            },
            {
                question: 'Is this more expensive than managing it ourselves?',
                answer: 'When you factor in the admin hours your staff spends on vendor coordination (8–10 hrs/week at $25–40/hr), plus the cost of missed quality issues and emergency replacements, most clients find XIRI is cost-neutral or saves money.',
            },
            {
                question: 'How quickly can we transition from our current setup?',
                answer: 'Typical transition takes 2–3 weeks. Your FSM conducts a site audit, builds the scope, identifies needed vendors, and coordinates the switchover with minimal disruption to your operations.',
            },
        ],
    },
    'nfc-proof-of-work': {
        title: 'NFC Proof of Work',
        heroTitle: 'Proof Your Building Was Actually Cleaned',
        heroSubtitle: 'NFC-verified check-ins, zone-by-zone task completion, and timestamped records — so you never have to wonder if the cleaning crew showed up.',
        metaDescription: 'NFC proof of work for commercial cleaning. Tamper-proof check-ins, zone-by-zone task verification, and timestamped digital records. Know your facility was cleaned — not just told it was.',
        problemTitle: 'You\'re Paying for Cleaning You Can\'t Verify',
        problemPoints: [
            'Your cleaning company says they showed up. You have no way to confirm it until you see a dirty floor Monday morning.',
            'Sign-in sheets get forged, backdated, or "accidentally" left blank — there\'s zero accountability',
            'GPS tracking only proves the van was in the parking lot. It doesn\'t prove they cleaned every restroom.',
            'You\'ve lost count of how many times you\'ve called to complain about a missed clean — and nothing changes',
            'When an inspector asks for proof of regular cleaning, all you have are invoices and promises',
        ],
        solutionTitle: 'NFC Tags That Can\'t Be Faked',
        solutionPoints: [
            {
                title: 'Physical Proof of Presence',
                description: 'NFC tags are mounted in each zone of your facility. Cleaners must physically be at the tag to scan it — no remote check-ins, no GPS spoofing, no paper logs to forge.',
            },
            {
                title: 'Zone-by-Zone Task Verification',
                description: 'After scanning into a zone, cleaners complete a task checklist specific to that area. Restroom tasks are different from lobby tasks. Every task is tracked and timestamped.',
            },
            {
                title: 'Automatic Time Tracking',
                description: 'Clock-in, clock-out, and zone scan times are recorded automatically. You see exactly when they arrived, how long they spent in each zone, and when they left.',
            },
            {
                title: 'Photo Documentation',
                description: 'Cleaners can attach photos to completed tasks — before-and-after shots, supply levels, or maintenance issues. Visual proof, not just checkboxes.',
            },
        ],
        relevantServices: ['janitorial-services', 'commercial-cleaning', 'medical-office-cleaning', 'urgent-care-cleaning'],
        comparisonTable: [
            { category: 'Proof of presence', diy: 'Paper sign-in sheet', software: 'GPS ping from parking lot', xiri: 'NFC scan inside each zone' },
            { category: 'Task verification', diy: 'Trust', software: 'Self-reported checklists', xiri: 'Zone-specific task lists + photos' },
            { category: 'Time tracking', diy: 'Manual entry', software: 'Clock-in/out only', xiri: 'Auto clock-in + per-zone timestamps' },
            { category: 'Forgery prevention', diy: 'None', software: 'GPS can be spoofed', xiri: 'Must physically touch NFC tag' },
            { category: 'Inspector-ready records', diy: 'Binder of paper logs', software: 'Export from portal', xiri: 'Public compliance log URL' },
            { category: 'Setup time', diy: 'Buy a clipboard', software: 'Months of integration', xiri: '30-minute site setup' },
        ],
        faqs: [
            {
                question: 'What is NFC proof of work for cleaning?',
                answer: 'NFC (Near Field Communication) tags are small, durable stickers mounted in each zone of your facility. Cleaning staff must physically hold their phone to the tag to check in — proving they were physically present in that zone at that exact time. Unlike GPS or paper logs, NFC scans can\'t be faked from the parking lot.',
            },
            {
                question: 'Can cleaners fake an NFC scan?',
                answer: 'No. NFC requires the phone to be within 1–2 inches of the physical tag. The tag is mounted inside each zone (restroom, lobby, break room), so the only way to scan it is to physically be there. This is fundamentally different from GPS, which only proves you were near the building.',
            },
            {
                question: 'What happens if a cleaner skips a zone?',
                answer: 'You\'ll see it immediately. The compliance log shows which zones were completed and which were missed. Your XIRI Facility Solutions Manager also monitors completion rates and follows up on partial shifts before you even notice.',
            },
            {
                question: 'How long does it take to set up NFC tags?',
                answer: 'About 30 minutes per site. Your FSM walks the facility, identifies zones, and places NFC tags in optimal locations. Cleaners get a simple URL and site key — no apps to install, no training required.',
            },
            {
                question: 'Do cleaners need a special app?',
                answer: 'No. The entire system runs in a mobile browser. Cleaners tap the NFC tag, which opens a web page. They enter a site key once, then tap each zone tag to scan in. No downloads, no logins, no passwords to remember.',
            },
        ],
    },
    'digital-compliance-log': {
        title: 'Digital Compliance Logs',
        heroTitle: 'Compliance Records That Are Always Inspector-Ready',
        heroSubtitle: 'Automatic, timestamped cleaning logs that prove your facility is maintained — without binders, spreadsheets, or chasing your cleaning company for documentation.',
        metaDescription: 'Digital cleaning compliance logs for commercial facilities. Automatic records, NFC-verified timestamps, and inspector-ready reports. Replace paper cleaning logs with tamper-proof digital documentation.',
        problemTitle: 'Paper Logs Are a Liability, Not Proof',
        problemPoints: [
            'Your cleaning log is a crumpled clipboard sheet that nobody fills out consistently — and inspectors know it',
            'When a state inspector or JCAHO surveyor asks for 90 days of cleaning records, you scramble to assemble something plausible',
            'Paper logs can be forged, backdated, or conveniently "lost" — they don\'t actually prove anything',
            'You can\'t prove frequency compliance (5x/week cleaning) because your records are too inconsistent to audit',
            'Your cleaning vendor sends invoices but no documentation — so you\'re paying for proof you don\'t have',
        ],
        solutionTitle: 'Compliance Logs That Write Themselves',
        solutionPoints: [
            {
                title: 'Automatic Record Creation',
                description: 'Every time a cleaner scans an NFC tag, a timestamped record is created automatically. No manual entry, no paper forms, no relying on someone to remember to sign in.',
            },
            {
                title: 'Inspector-Ready Format',
                description: 'Your compliance log is a clean, professional table: date, time in, time out, staff initials, zones completed, and task details. Expand any row to see exactly what was done. Designed for inspectors who need to make quick decisions.',
            },
            {
                title: 'Public URL for Instant Access',
                description: 'Each facility gets its own compliance log URL. Share it with inspectors, property managers, or corporate compliance teams. No login required — just scan a QR code or tap a link.',
            },
            {
                title: 'Completion Rate Tracking',
                description: 'Your log automatically calculates completion rates across zones and visits. At a glance, inspectors see that your facility is cleaned 5x/week with 96% zone completion — no manual calculation needed.',
            },
        ],
        relevantServices: ['janitorial-services', 'commercial-cleaning', 'medical-office-cleaning', 'urgent-care-cleaning', 'surgery-center-cleaning'],
        comparisonTable: [
            { category: 'Record creation', diy: 'Manual sign-in sheet', software: 'Digital checklist (manual entry)', xiri: 'Automatic NFC-triggered records' },
            { category: 'Timestamp accuracy', diy: 'Whatever they write', software: 'Self-reported time', xiri: 'NFC scan = exact timestamp' },
            { category: 'Inspector access', diy: 'Dig through a binder', software: 'Log into a portal', xiri: 'Public URL — scan QR, see log' },
            { category: 'Forgery risk', diy: 'High — anyone can sign', software: 'Medium — self-reported', xiri: 'None — NFC + auto-timestamp' },
            { category: 'Historical records', diy: 'If someone kept them', software: 'If subscription is active', xiri: 'Always accessible, 30-day rolling' },
            { category: 'Setup effort', diy: 'Print a form', software: 'Configure software + train staff', xiri: 'Included with XIRI service' },
        ],
        faqs: [
            {
                question: 'What is a digital compliance log?',
                answer: 'A digital compliance log is an automated, timestamped record of every cleaning session at your facility. Instead of paper sign-in sheets, each cleaning visit is recorded when staff scan NFC tags mounted in your facility. The log shows dates, times, zones cleaned, tasks completed, and staff initials — all generated automatically.',
            },
            {
                question: 'Can inspectors access our compliance log?',
                answer: 'Yes. Each facility gets a unique URL that displays your compliance log in a clean, professional format. You can share this link with state inspectors, JCAHO surveyors, property managers, or corporate compliance teams. No login required — they see the same data you see.',
            },
            {
                question: 'How far back do the records go?',
                answer: 'The public compliance log shows the last 30 days of activity by default. Full historical records are maintained in your XIRI dashboard for as long as your service is active.',
            },
            {
                question: 'What information does the compliance log show?',
                answer: 'Each entry shows: date, clock-in time, clock-out time, session duration, staff initials (full names are hidden for privacy), completion status, and a per-zone breakdown with individual task checklists. Inspectors can expand any row to see zone-level details.',
            },
            {
                question: 'Is this HIPAA compliant?',
                answer: 'Yes. The public compliance log shows only staff initials, not full names. No patient data, health information, or facility-specific sensitive information is exposed. The log is purely a record of cleaning activity.',
            },
        ],
    },
    'keep-your-cleaner': {
        title: 'Keep Your Cleaner, Add Accountability',
        heroTitle: 'Keep Your Cleaner. We\'ll Verify Them.',
        heroSubtitle: 'Love your cleaning crew but hate the uncertainty? We install NFC verification in your facility and give you proof of work — without replacing anyone.',
        metaDescription: 'Keep your existing cleaning company and add NFC-verified proof of work. XIRI installs the verification system, you get a compliance log every morning. No vendor change required.',
        problemTitle: 'You Trust Your Cleaner — But Can You Prove It?',
        problemPoints: [
            'Your cleaning company has been with you for years. You like them. But you can\'t actually prove they cleaned every room last Tuesday night.',
            'When a state inspector, landlord, or corporate compliance team asks for documentation — all you have are invoices and a relationship.',
            'You\'ve occasionally suspected corners are being cut, but confronting a vendor you trust feels uncomfortable without hard evidence.',
            'If you switch to a new cleaning company, you solve nothing — you trade one unverifiable vendor for another.',
            'You don\'t need a new cleaner. You need a way to know what\'s actually happening in your building every night.',
        ],
        solutionTitle: 'Verification Without Disruption',
        solutionPoints: [
            {
                title: 'We Install, You Observe',
                description: 'We place NFC tags in each zone of your facility — restrooms, lobbies, offices, break rooms. Your existing cleaning crew taps each tag with their phone as they work. Takes 10 minutes to learn.',
            },
            {
                title: 'Your Morning Report',
                description: 'Every morning, you see exactly what happened: which zones were cleaned, what time the crew arrived and left, and which tasks were completed. If a room was skipped — you\'ll know before you walk in.',
            },
            {
                title: 'Data, Not Drama',
                description: 'No need for confrontation. The compliance log gives you objective data to have productive conversations with your vendor. Most cleaners actually appreciate the accountability — it proves they did the work.',
            },
            {
                title: 'Inspector-Ready Documentation',
                description: 'Each facility gets a public compliance log URL you can share with inspectors, landlords, or corporate compliance teams. Proof you never had before — without changing a single vendor.',
            },
        ],
        relevantServices: ['janitorial-services', 'commercial-cleaning', 'medical-office-cleaning'],
        comparisonTable: [
            { category: 'Keep existing cleaner?', diy: 'Yes (no verification)', software: 'Yes (self-reported)', xiri: 'Yes + NFC verification' },
            { category: 'Setup time', diy: 'None', software: 'Weeks of integration', xiri: '30 minutes' },
            { category: 'Who does the work?', diy: 'You manage everything', software: 'You manage the software', xiri: 'We install + monitor' },
            { category: 'Proof of presence', diy: 'None', software: 'GPS (parking lot only)', xiri: 'NFC scan inside each room' },
            { category: 'Compliance log', diy: 'Paper binder', software: 'Digital (manual entry)', xiri: 'Auto-generated, shareable URL' },
            { category: 'Monthly cost', diy: '$0 (no accountability)', software: '$200-500/mo + your time', xiri: 'Per-zone flat fee' },
        ],
        faqs: [
            {
                question: 'Do I have to switch cleaning companies?',
                answer: 'No. That\'s the entire point. You keep your existing cleaning crew. We add the NFC verification layer so you get proof of work every night. If the data shows they\'re doing great — you now have documentation to prove it.',
            },
            {
                question: 'How much does this cost?',
                answer: 'We charge a flat per-zone monthly fee. A typical 6-zone facility runs $150-250/month for full NFC verification, compliance logging, and a dedicated compliance log URL.',
            },
            {
                question: 'What if my cleaner refuses to use the NFC system?',
                answer: 'That tells you something important. In practice, most cleaners welcome it — it proves they did the work and protects them from false complaints. If a vendor refuses accountability, that\'s a data point worth having.',
            },
            {
                question: 'What if the data shows my cleaner IS cutting corners?',
                answer: 'You\'ll have specific, timestamped evidence to have a productive conversation. "Zone 3 was skipped on Tuesday and Thursday" is a much better starting point than "I feel like things aren\'t getting done." If you decide to switch vendors, we can manage that transition too.',
            },
            {
                question: 'Can I upgrade to full XIRI facility management later?',
                answer: 'Absolutely. Many clients start with verification-only and upgrade once they see the value. Your NFC system, compliance history, and zone configuration carry over seamlessly.',
            },
        ],
    },
};
