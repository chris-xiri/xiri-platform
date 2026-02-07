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
export declare const analyzeIncomingMessage: (vendor: any, messageContent: string, previousContext: string) => Promise<any>;
//# sourceMappingURL=outreach.d.ts.map