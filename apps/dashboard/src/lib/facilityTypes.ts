"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FACILITY_TYPE_LABELS, FACILITY_TYPE_OPTIONS } from "@xiri-facility-solutions/shared";

export interface FacilityTypeOption {
    value: string;
    label: string;
}

function slugifyFacilityTypeLabel(label: string): string {
    return label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

export async function ensureCustomFacilityType(label: string): Promise<{ value: string; label: string }> {
    const normalizedLabel = label.trim().replace(/\s+/g, " ");
    const value = slugifyFacilityTypeLabel(normalizedLabel);
    if (!value) {
        throw new Error("Facility type label cannot be empty.");
    }

    await setDoc(doc(db, "facility_types_custom", value), {
        slug: value,
        label: normalizedLabel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    return { value, label: normalizedLabel };
}

export function useFacilityTypes() {
    const [customFacilityTypes, setCustomFacilityTypes] = useState<Record<string, string>>({});

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "facility_types_custom"), (snap) => {
            const next: Record<string, string> = {};
            snap.forEach((d) => {
                next[d.id] = d.data().label || d.id;
            });
            setCustomFacilityTypes(next);
        });
        return () => unsub();
    }, []);

    const facilityTypeLabels = useMemo(() => {
        return {
            ...FACILITY_TYPE_LABELS,
            ...customFacilityTypes,
        } as Record<string, string>;
    }, [customFacilityTypes]);

    const facilityTypeOptions = useMemo<FacilityTypeOption[]>(() => {
        const staticOptions = FACILITY_TYPE_OPTIONS.map((option) => ({
            value: option.value as string,
            label: option.label,
        }));
        const customOptions = Object.entries(customFacilityTypes)
            .filter(([value]) => !(value in FACILITY_TYPE_LABELS))
            .map(([value, label]) => ({ value, label }));

        return [...staticOptions, ...customOptions].sort((a, b) => a.label.localeCompare(b.label));
    }, [customFacilityTypes]);

    return {
        customFacilityTypes,
        facilityTypeLabels,
        facilityTypeOptions,
    };
}
