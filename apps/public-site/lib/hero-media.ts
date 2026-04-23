export interface HeroMediaSlide {
    imageSrc: string;
    alt: string;
    facilityName: string;
    facilityType: string;
    serviceFocus: string;
    showCleaningVerifiedBadge?: boolean;
}

const slide = (
    imageSrc: string,
    alt: string,
    facilityName: string,
    facilityType: string,
    serviceFocus: string,
    showCleaningVerifiedBadge: boolean = true
): HeroMediaSlide => ({
    imageSrc,
    alt,
    facilityName,
    facilityType,
    serviceFocus,
    showCleaningVerifiedBadge,
});

const CLEANING_CORE = slide(
    '/hero/office-lobby-cleaning.png',
    'Professional cleaning crew servicing an office lobby after hours',
    'Commercial Office',
    'Commercial Facility',
    'Nightly Commercial Cleaning'
);
const MEDICAL_WAITING = slide(
    '/hero/medical-waiting-room-disinfecting.png',
    'Janitorial professional disinfecting a medical waiting room',
    'Medical Suite',
    'Medical Facility',
    'Waiting Room Disinfection'
);
const SCHOOL_HALL = slide(
    '/hero/school-hallway-cleaning.png',
    'Cleaning technician mopping a private school hallway',
    'Private School',
    'Education Facility',
    'After-Hours Hallway Cleaning'
);
const RESTROOM_TOUCHPOINT = slide(
    '/hero/restroom-touchpoint-disinfection.png',
    'Cleaning technician sanitizing sink and touchpoints in a commercial restroom',
    'Office Restrooms',
    'Commercial Facility',
    'Touchpoint Sanitization'
);
const RESTROOM_CART = slide(
    '/hero/restroom-sanitation-cart.png',
    'Sanitized commercial restroom with a janitorial cart staged for service',
    'Corporate Campus',
    'Commercial Facility',
    'Restroom Sanitation Protocol'
);
const CONFERENCE_ROOM = slide(
    '/hero/conference-room-detail-cleaning.png',
    'After-hours conference room detail cleaning in a corporate office',
    'Corporate HQ',
    'Commercial Facility',
    'Conference Room Detail Cleaning'
);
const AUTO_DEALERSHIP = slide(
    '/hero/auto-dealership-showroom-cleaning.png',
    'Janitorial technician cleaning polished floors in an automotive showroom',
    'Auto Dealership',
    'Automotive Facility',
    'Showroom Floor Care'
);
const DAYCARE = slide(
    '/hero/daycare-classroom-sanitizing.png',
    'Professional cleaner sanitizing classroom surfaces in a daycare',
    'Daycare Center',
    'Childcare Facility',
    'Child-Safe Classroom Sanitizing'
);
const DENTAL = slide(
    '/hero/dental-operatory-cleaning.png',
    'Dental operatory being disinfected by a trained cleaning technician',
    'Dental Office',
    'Healthcare Facility',
    'Operatory Disinfection'
);
const DIALYSIS = slide(
    '/hero/dialysis-center-disinfection.png',
    'Dialysis treatment area being sanitized after patient sessions',
    'Dialysis Center',
    'Healthcare Facility',
    'Clinical Surface Disinfection'
);
const VETERINARY = slide(
    '/hero/veterinary-clinic-sanitation.png',
    'Veterinary exam room sanitation by a commercial cleaning specialist',
    'Veterinary Clinic',
    'Healthcare Facility',
    'Exam Room Sanitation'
);
const GYM = slide(
    '/hero/gym-equipment-sanitizing.png',
    'Cleaning professional disinfecting high-touch gym equipment',
    'Fitness Center',
    'Athletic Facility',
    'High-Touch Equipment Sanitizing'
);
const RETAIL = slide(
    '/hero/retail-storefront-floor-cleaning.png',
    'After-hours retail storefront floor cleaning and detailing',
    'Retail Storefront',
    'Retail Facility',
    'High-Traffic Floor Cleaning'
);
const WINDOW = slide(
    '/hero/commercial-window-cleaning.png',
    'Commercial window cleaning in a multi-story office building',
    'Office Tower',
    'Commercial Facility',
    'Interior Window Cleaning'
);
const PEST = slide(
    '/hero/pest-control-application.png',
    'Licensed technician applying pest control treatment in a commercial space',
    'Office Interior',
    'Commercial Facility',
    'Integrated Pest Control',
    false
);
const HVAC = slide(
    '/hero/hvac-filter-maintenance.png',
    'Technician replacing HVAC filtration components in a commercial mechanical room',
    'Mechanical Room',
    'Building Systems',
    'HVAC Filter Maintenance',
    false
);
const PRESSURE = slide(
    '/hero/exterior-pressure-washing.png',
    'Exterior pressure washing along a commercial building facade',
    'Building Exterior',
    'Commercial Facility',
    'Exterior Pressure Washing',
    false
);
const SNOW = slide(
    '/hero/snow-ice-removal-sidewalk.png',
    'Crew clearing snow and ice from a commercial sidewalk at dawn',
    'Property Entrance',
    'Commercial Facility',
    'Snow and Ice Management',
    false
);
const POST_CONSTRUCTION = slide(
    '/hero/post-construction-cleanup.png',
    'Post-construction cleanup team removing dust and debris in a finished interior',
    'New Build Interior',
    'Commercial Facility',
    'Post-Construction Final Clean'
);
const LIGHT_MANUFACTURING = slide(
    '/hero/light-manufacturing-floor-cleaning.png',
    'Industrial floor scrubber operating in a light manufacturing facility',
    'Production Floor',
    'Industrial Facility',
    'Industrial Floor Scrubbing'
);
const CLEANROOM = slide(
    '/hero/cleanroom-sanitation.png',
    'Cleanroom sanitation with PPE-compliant protocol and sterile surfaces',
    'ISO Cleanroom',
    'Lab Facility',
    'Controlled-Environment Cleaning'
);
const PLANT = slide(
    '/hero/indoor-plant-watering-service.png',
    'Technician watering and maintaining indoor plants in a commercial lobby',
    'Corporate Lobby',
    'Commercial Facility',
    'Indoor Plant Watering',
    false
);
const HANDYMAN = slide(
    '/hero/handyman-light-maintenance.png',
    'Handyman performing light fixture and wall maintenance in an office',
    'Office Interior',
    'Commercial Facility',
    'Light Repair and Maintenance',
    false
);
const WASTE = slide(
    '/hero/waste-management-collection.png',
    'Managed commercial waste and recycling collection at a facility dock',
    'Service Yard',
    'Commercial Facility',
    'Waste and Recycling Management',
    false
);
const PARKING = slide(
    '/hero/parking-lot-sweeping.png',
    'Parking lot sweeping crew maintaining paved surfaces at a commercial property',
    'Parking Area',
    'Commercial Facility',
    'Parking Lot Sweeping',
    false
);
const OFFICE_BUFF = slide(
    '/hero/office-lobby-floor-buffing.png',
    'Commercial cleaner using a floor buffer in an office lobby',
    'Corporate Lobby',
    'Commercial Facility',
    'Lobby Floor Buffing'
);
const OFFICE_SCRUB = slide(
    '/hero/office-lobby-autoscrubber.png',
    'Autoscrubber service in a large office lobby after hours',
    'Office Lobby',
    'Commercial Facility',
    'Autoscrubber Floor Care'
);
const MEDICAL_WAITING_TWO = slide(
    '/hero/medical-waiting-room-disinfecting-2.png',
    'High-touch disinfection in a modern medical waiting room',
    'Medical Waiting Area',
    'Medical Facility',
    'High-Touch Surface Disinfection'
);
const SCHOOL_HALL_TWO = slide(
    '/hero/school-hallway-mopping.png',
    'Custodial crew mopping a school corridor after class hours',
    'School Corridor',
    'Education Facility',
    'After-Hours Corridor Cleaning'
);

const INDUSTRY_SLIDES: Record<string, HeroMediaSlide[]> = {
    'medical-offices': [MEDICAL_WAITING, MEDICAL_WAITING_TWO, RESTROOM_TOUCHPOINT],
    'urgent-care': [MEDICAL_WAITING_TWO, DIALYSIS, RESTROOM_TOUCHPOINT],
    'surgery-centers': [DENTAL, DIALYSIS, CLEANROOM],
    'auto-dealerships': [AUTO_DEALERSHIP, OFFICE_BUFF, RESTROOM_CART],
    'daycare-preschool': [DAYCARE, SCHOOL_HALL, RESTROOM_TOUCHPOINT],
    'dental-offices': [DENTAL, MEDICAL_WAITING_TWO, RESTROOM_TOUCHPOINT],
    'dialysis-centers': [DIALYSIS, MEDICAL_WAITING_TWO, RESTROOM_TOUCHPOINT],
    'veterinary-clinics': [VETERINARY, RESTROOM_TOUCHPOINT, CONFERENCE_ROOM],
    'fitness-gyms': [GYM, RESTROOM_TOUCHPOINT, OFFICE_SCRUB],
    'professional-offices': [OFFICE_BUFF, CONFERENCE_ROOM, RESTROOM_CART],
    'private-schools': [SCHOOL_HALL, SCHOOL_HALL_TWO, DAYCARE],
    'retail-storefronts': [RETAIL, WINDOW, RESTROOM_CART],
    'labs-cleanrooms': [CLEANROOM, LIGHT_MANUFACTURING, DIALYSIS],
    'light-manufacturing': [LIGHT_MANUFACTURING, CLEANROOM, POST_CONSTRUCTION],
    'converted-clinical-suites': [MEDICAL_WAITING, DENTAL, DIALYSIS],
};

const SERVICE_SLIDES: Record<string, HeroMediaSlide[]> = {
    'medical-office-cleaning': [MEDICAL_WAITING, MEDICAL_WAITING_TWO, RESTROOM_TOUCHPOINT],
    'urgent-care-cleaning': [MEDICAL_WAITING_TWO, DIALYSIS, RESTROOM_TOUCHPOINT],
    'surgery-center-cleaning': [DENTAL, CLEANROOM, DIALYSIS],
    'daycare-cleaning': [DAYCARE, SCHOOL_HALL, SCHOOL_HALL_TWO],
    'floor-care': [OFFICE_BUFF, OFFICE_SCRUB, AUTO_DEALERSHIP],
    'carpet-upholstery': [CONFERENCE_ROOM, OFFICE_SCRUB, RETAIL],
    'commercial-cleaning': [CLEANING_CORE, OFFICE_BUFF, RESTROOM_CART],
    'day-porter': [OFFICE_SCRUB, RETAIL, CONFERENCE_ROOM],
    'disinfecting-services': [MEDICAL_WAITING_TWO, RESTROOM_TOUCHPOINT, GYM],
    'janitorial-services': [CLEANING_CORE, RESTROOM_CART, CONFERENCE_ROOM],
    'window-cleaning': [WINDOW, RETAIL, OFFICE_SCRUB],
    'pressure-washing': [PRESSURE],
    'snow-ice-removal': [SNOW],
    'hvac-maintenance': [HVAC],
    'pest-control': [PEST],
    'waste-management': [WASTE],
    'parking-lot-maintenance': [PARKING, PRESSURE, SNOW],
    'handyman-services': [HANDYMAN],
    'post-construction-cleanup': [POST_CONSTRUCTION],
    'preventive-maintenance': [HVAC, HANDYMAN, PEST],
    'indoor-plant-watering': [PLANT],
};

const PILLAR_SLIDES: Record<string, HeroMediaSlide[]> = {
    medical: [MEDICAL_WAITING, DIALYSIS, DENTAL],
    commercial: [OFFICE_BUFF, RETAIL, AUTO_DEALERSHIP],
    specialty: [CLEANROOM, LIGHT_MANUFACTURING, VETERINARY],
};

export function getIndustryHeroSlides(slug: string): HeroMediaSlide[] | undefined {
    return INDUSTRY_SLIDES[slug];
}

export function getServiceHeroSlides(slug: string): HeroMediaSlide[] | undefined {
    return SERVICE_SLIDES[slug];
}

export function getPillarHeroSlides(slug: string): HeroMediaSlide[] | undefined {
    return PILLAR_SLIDES[slug];
}
