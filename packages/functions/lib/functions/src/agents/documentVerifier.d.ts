interface VerificationResult {
    valid: boolean;
    reasoning: string;
    extracted: Record<string, any>;
}
export declare function verifyDocument(docType: 'COI' | 'W9', vendorName: string, specialty: string): Promise<VerificationResult>;
export {};
//# sourceMappingURL=documentVerifier.d.ts.map