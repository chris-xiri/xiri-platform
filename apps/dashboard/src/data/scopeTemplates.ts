import { ScopeTemplate } from '@xiri/shared';

/**
 * Starter scope templates for the three primary facility verticals.
 * These are used when creating quotes/work orders to pre-populate task checklists.
 */
export const SCOPE_TEMPLATES: Omit<ScopeTemplate, 'id' | 'createdAt'>[] = [
    {
        name: 'Medical - Urgent Care',
        facilityType: 'medical_urgent_care',
        defaultFrequency: 'nightly',
        defaultStartTime: '21:00',
        tasks: [
            { name: 'Lobby & Waiting Area', description: 'Vacuum, mop, dust surfaces, sanitize seating', required: true },
            { name: 'Exam Rooms', description: 'Sanitize exam tables, mop floors, empty trash, wipe surfaces', required: true },
            { name: 'Restrooms', description: 'Deep clean, restock consumables, sanitize fixtures', required: true },
            { name: 'Break Room / Kitchen', description: 'Clean counters, appliances, empty trash, mop floor', required: true },
            { name: 'Hallways & Corridors', description: 'Vacuum/mop, dust baseboards, clean door handles', required: true },
            { name: 'Front Desk Area', description: 'Wipe counters, sanitize phone/keyboard, empty trash', required: true },
            { name: 'Biohazard Waste', description: 'Verify proper disposal, replace sharps containers if needed', required: true },
            { name: 'Entry Glass & Windows', description: 'Clean interior glass, remove fingerprints/smudges', required: false },
        ]
    },
    {
        name: 'Class-B Office',
        facilityType: 'office_general',
        defaultFrequency: 'nightly',
        defaultStartTime: '19:00',
        tasks: [
            { name: 'Common Areas & Lobby', description: 'Vacuum, dust, clean elevator buttons, polish surfaces', required: true },
            { name: 'Kitchen / Breakroom', description: 'Clean counters, sink, appliances, restock supplies', required: true },
            { name: 'Restrooms', description: 'Deep clean, restock paper/soap, sanitize fixtures', required: true },
            { name: 'Trash & Recycling', description: 'Empty all bins, replace liners, consolidate recycling', required: true },
            { name: 'Floors', description: 'Vacuum carpet, mop hard surfaces, spot clean stains', required: true },
        ]
    },
    {
        name: 'Auto Service Center',
        facilityType: 'auto_service_center',
        defaultFrequency: 'nightly',
        defaultStartTime: '20:00',
        tasks: [
            { name: 'Showroom Floor', description: 'Dust vehicles, vacuum floor, clean glass displays', required: true },
            { name: 'Service Bay', description: 'Sweep/scrub floors, degrease work areas, organize tools', required: true },
            { name: 'Customer Lounge', description: 'Vacuum, clean seating, wipe tables, restock coffee area', required: true },
            { name: 'Restrooms', description: 'Deep clean, restock consumables, mop floors', required: true },
            { name: 'Parking Lot', description: 'Sweep entrances, pick up debris, empty outdoor trash', required: false },
            { name: 'Windows & Glass', description: 'Clean showroom and entrance glass inside and out', required: false },
        ]
    }
];
