export declare const generateOutreachContent: (vendor: any, preferredChannel: "SMS" | "EMAIL") => Promise<{
    channel: "SMS" | "EMAIL";
    sms: any;
    email: any;
    generatedAt: Date;
    error?: undefined;
} | {
    channel: "SMS" | "EMAIL";
    sms: string;
    email: {
        subject: string;
        body: string;
    };
    error: boolean;
    generatedAt?: undefined;
}>;
//# sourceMappingURL=outreach.d.ts.map