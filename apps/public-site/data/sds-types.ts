export interface SDSReference {
    label: string;
    url: string;
    authority: 'EPA' | 'CDC' | 'OSHA' | 'NIOSH' | 'Green Seal' | 'NYS DEC' | 'NIH' | 'NSF' | 'Manufacturer';
}

export type SDSCategory = 'disinfectant' | 'floor-care' | 'glass-surface' | 'restroom' | 'degreaser' | 'specialty';

export interface SDSEntry {
    id: string;
    name: string;
    manufacturer: string;
    category: SDSCategory;
    categoryLabel: string;
    activeIngredient: string;
    epaRegNumber?: string;
    vocCompliant: boolean;
    vocGperL?: number;
    greenSealCertified: boolean;
    greenSealStandard?: string;
    greenSealSaferList?: boolean;
    epaSaferChoice?: boolean;
    epaListN?: boolean;
    ulEcologo?: boolean;
    dilutionRatio: string;
    dwellTime: string;
    hazards: string[];
    ppe: string[];
    firstAid: string;
    storage: string;
    disposal: string;
    suitableFor: string[];
    notSuitableFor: string[];
    regulationNotes: string;
    sdsUrl?: string;
    references: SDSReference[];
}
