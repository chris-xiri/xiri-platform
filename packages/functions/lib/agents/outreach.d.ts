export declare const generateOutreachContent: (vendor: any, preferredChannel: "SMS" | "EMAIL") => Promise<{
    channel: "SMS" | "EMAIL";
    content: string;
    generatedAt: Date;
    error?: undefined;
} | {
    channel: "SMS" | "EMAIL";
    content: string;
    error: boolean;
    generatedAt?: undefined;
}>;
//# sourceMappingURL=outreach.d.ts.map