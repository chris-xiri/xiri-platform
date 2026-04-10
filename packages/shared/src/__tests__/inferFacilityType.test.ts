import { describe, it, expect } from 'vitest';
import { inferFacilityType } from '../index';

describe('inferFacilityType', () => {
    // ── Null / undefined / empty ────────────────────────────────────
    it('returns null for undefined', () => {
        expect(inferFacilityType(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(inferFacilityType('')).toBeNull();
    });

    it('returns null for unrecognized term', () => {
        expect(inferFacilityType('random gibberish xyz')).toBeNull();
    });

    // ── Medical ─────────────────────────────────────────────────────
    it('infers dialysis center', () => {
        expect(inferFacilityType('dialysis center near me')).toBe('medical_dialysis');
    });

    it('infers urgent care', () => {
        expect(inferFacilityType('urgent care clinic')).toBe('medical_urgent_care');
    });

    it('infers surgery center', () => {
        expect(inferFacilityType('outpatient surgery center')).toBe('medical_surgery');
        expect(inferFacilityType('surgical center')).toBe('medical_surgery');
    });

    it('infers dental office', () => {
        expect(inferFacilityType('dental office')).toBe('medical_dental');
        expect(inferFacilityType('dentist office near Queens')).toBe('medical_dental');
    });

    it('infers veterinary clinic', () => {
        expect(inferFacilityType('veterinary hospital')).toBe('medical_veterinary');
        expect(inferFacilityType('vet clinic')).toBe('medical_veterinary');
        expect(inferFacilityType('animal hospital')).toBe('medical_veterinary');
    });

    it('infers private medical practice', () => {
        expect(inferFacilityType('medical office')).toBe('medical_private');
        expect(inferFacilityType('doctor office')).toBe('medical_private');
        expect(inferFacilityType('physician practice')).toBe('medical_private');
        expect(inferFacilityType('clinic near Garden City')).toBe('medical_private');
    });

    // ── Physical Therapy (must come BEFORE gym/fitness) ─────────────
    it('infers physical therapy (not gym)', () => {
        expect(inferFacilityType('physical therapy clinic')).toBe('medical_physical_therapy');
        expect(inferFacilityType('physiotherapy center')).toBe('medical_physical_therapy');
        expect(inferFacilityType('pt clinic near me')).toBe('medical_physical_therapy');
        expect(inferFacilityType('rehab center')).toBe('medical_physical_therapy');
        expect(inferFacilityType('rehabilitation facility')).toBe('medical_physical_therapy');
    });

    // ── Education ───────────────────────────────────────────────────
    it('infers daycare', () => {
        expect(inferFacilityType('daycare center')).toBe('edu_daycare');
        expect(inferFacilityType('preschool')).toBe('edu_daycare');
        expect(inferFacilityType('childcare facility')).toBe('edu_daycare');
    });

    it('infers tutoring center', () => {
        expect(inferFacilityType('tutoring center')).toBe('edu_tutoring');
        expect(inferFacilityType('kumon learning center')).toBe('edu_tutoring');
        expect(inferFacilityType('mathnasium near me')).toBe('edu_tutoring');
        expect(inferFacilityType('sylvan learning')).toBe('edu_tutoring');
        expect(inferFacilityType('test prep center')).toBe('edu_tutoring');
    });

    it('infers private school', () => {
        expect(inferFacilityType('private school')).toBe('edu_private_school');
        expect(inferFacilityType('academy of arts')).toBe('edu_private_school');
    });

    // ── Auto ────────────────────────────────────────────────────────
    it('infers auto dealership', () => {
        expect(inferFacilityType('car dealership')).toBe('auto_dealer_showroom');
        expect(inferFacilityType('auto dealer')).toBe('auto_dealer_showroom');
    });

    it('infers auto service center', () => {
        expect(inferFacilityType('auto service center')).toBe('auto_service_center');
        expect(inferFacilityType('auto repair shop')).toBe('auto_service_center');
        expect(inferFacilityType('mechanic shop')).toBe('auto_service_center');
    });

    // ── Lab ─────────────────────────────────────────────────────────
    it('infers cleanroom/lab', () => {
        expect(inferFacilityType('cleanroom facility')).toBe('lab_cleanroom');
        expect(inferFacilityType('lab testing')).toBe('lab_cleanroom');
    });

    it('infers BSL lab', () => {
        expect(inferFacilityType('bsl-2 laboratory')).toBe('lab_bsl');
        expect(inferFacilityType('biosafety lab')).toBe('lab_bsl');
    });

    // ── Manufacturing ───────────────────────────────────────────────
    it('infers manufacturing', () => {
        expect(inferFacilityType('manufacturing plant')).toBe('manufacturing_light');
        expect(inferFacilityType('factory floor cleaning')).toBe('manufacturing_light');
        expect(inferFacilityType('warehouse cleaning')).toBe('manufacturing_light');
    });

    // ── Fitness ─────────────────────────────────────────────────────
    it('infers gym/fitness', () => {
        expect(inferFacilityType('gym near me')).toBe('fitness_gym');
        expect(inferFacilityType('fitness center')).toBe('fitness_gym');
        expect(inferFacilityType('crossfit box')).toBe('fitness_gym');
        expect(inferFacilityType('yoga studio')).toBe('fitness_gym');
    });

    // ── Retail ──────────────────────────────────────────────────────
    it('infers retail storefront', () => {
        expect(inferFacilityType('retail store')).toBe('retail_storefront');
        expect(inferFacilityType('boutique shop')).toBe('retail_storefront');
    });

    // ── Religious ───────────────────────────────────────────────────
    it('infers religious center', () => {
        expect(inferFacilityType('church near me')).toBe('religious_center');
        expect(inferFacilityType('mosque cleaning')).toBe('religious_center');
        expect(inferFacilityType('synagogue')).toBe('religious_center');
        expect(inferFacilityType('temple of peace')).toBe('religious_center');
        expect(inferFacilityType('house of worship')).toBe('religious_center');
    });

    // ── Funeral ─────────────────────────────────────────────────────
    it('infers funeral home', () => {
        expect(inferFacilityType('funeral home near me')).toBe('funeral_home');
        expect(inferFacilityType('mortuary services')).toBe('funeral_home');
        expect(inferFacilityType('cremation center')).toBe('funeral_home');
    });

    // ── Office (fallback) ───────────────────────────────────────────
    it('infers general office as fallback', () => {
        expect(inferFacilityType('office building')).toBe('office_general');
        expect(inferFacilityType('law office')).toBe('office_general');
    });

    // ── Precedence tests ────────────────────────────────────────────
    it('physical therapy beats gym (order of precedence)', () => {
        // "physical therapy" should NOT match gym even though "therapy" isn't a gym term
        expect(inferFacilityType('physical therapy gym')).toBe('medical_physical_therapy');
    });

    it('urgent care beats general medical', () => {
        expect(inferFacilityType('urgent care medical center')).toBe('medical_urgent_care');
    });

    it('dialysis beats general medical', () => {
        expect(inferFacilityType('dialysis clinic')).toBe('medical_dialysis');
    });

    it('dental beats general medical', () => {
        expect(inferFacilityType('dental clinic')).toBe('medical_dental');
    });

    it('tutoring beats private school (order of precedence)', () => {
        expect(inferFacilityType('tutoring academy')).toBe('edu_tutoring');
    });
});
