// Re-export shared types
export * from "@xiri/shared";

export interface RecruitmentAnalysisResult {
    analyzed: number;
    qualified: number;
    errors: string[];
}
