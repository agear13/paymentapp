import { z } from 'zod';

export const AGREEMENT_SAMPLE_IDS = [
  'promoter-revenue-share',
  'venue-hire',
  'dj-performance',
  'sponsorship',
  'contractor',
  'event-partnership',
] as const;

export type AgreementSampleId = (typeof AGREEMENT_SAMPLE_IDS)[number];

export const AgreementBenchmarkCategorySchema = z.enum([
  'revenueShare',
  'event',
  'service',
  'partnership',
]);

export const AgreementBenchmarkDifficultySchema = z.enum(['simple', 'medium', 'complex']);

export const ExpectedAgreementEvaluationSchema = z.object({
  commercialRelationshipType: z.string(),
  category: AgreementBenchmarkCategorySchema.optional(),
  difficulty: AgreementBenchmarkDifficultySchema.optional(),
  parties: z.array(z.unknown()),
  roles: z.array(z.unknown()).optional(),
  revenueSplits: z.array(z.unknown()),
  paymentConditions: z.array(z.unknown()).optional(),
  obligationCount: z.number().int().nonnegative(),
  riskCount: z.number().int().nonnegative(),
  missingClauseCount: z.number().int().nonnegative(),
});

export type ExpectedAgreementEvaluation = z.infer<typeof ExpectedAgreementEvaluationSchema>;
export type AgreementBenchmarkCategory = z.infer<typeof AgreementBenchmarkCategorySchema>;
export type AgreementBenchmarkDifficulty = z.infer<typeof AgreementBenchmarkDifficultySchema>;
export const NormalizedActualExtractionSchema = z.object({
  commercialRelationshipType: z.string().optional(),
  parties: z.array(z.unknown()),
  revenueSplits: z.array(z.unknown()),
  obligations: z.array(z.unknown()),
  risks: z.array(z.unknown()),
  missingInformation: z.array(z.unknown()),
});

export type NormalizedActualExtraction = z.infer<typeof NormalizedActualExtractionSchema>;

export type EvaluationMetricScore = {
  score: number;
  expectedCount: number;
  actualCount: number;
  matchedCount?: number;
};

export type AgreementEvaluationMetrics = {
  relationshipClassification: EvaluationMetricScore;
  parties: EvaluationMetricScore;
  revenueSplits: EvaluationMetricScore;
  obligations: EvaluationMetricScore;
  risks: EvaluationMetricScore;
  missingClauses: EvaluationMetricScore;
  overall: number;
};

export type AgreementEvaluationResult = {
  agreementId: string;
  commercialRelationshipType: string;
  category?: AgreementBenchmarkCategory;
  difficulty?: AgreementBenchmarkDifficulty;
  status: 'evaluated' | 'missing_actual' | 'invalid_actual';
  metrics: AgreementEvaluationMetrics;
  notes?: string[];
};

export type BenchmarkPerAgreementResult = AgreementEvaluationResult & {
  extractionStatus: 'success' | 'failed';
  extractionError?: string;
};

export type BenchmarkCategorySummary = {
  count: number;
  relationshipClassification: number;
  parties: number;
  revenueSplits: number;
  obligations: number;
  risks: number;
  missingClauses: number;
  overall: number;
};

export type BenchmarkProviderMetadata = {
  provider: 'claude' | 'openai';
  model: string;
};

export type BenchmarkReport = {
  generatedAt: string;
  samplesDirectory: string;
  provider: BenchmarkProviderMetadata;
  extraction: {
    processed: number;
    succeeded: number;
    failed: number;
  };
  overallMetrics: {
    relationshipClassification: number;
    parties: number;
    revenueSplits: number;
    obligations: number;
    risks: number;
    missingClauses: number;
    overall: number;
  };
  perAgreement: BenchmarkPerAgreementResult[];
  topPerformers: BenchmarkPerAgreementResult[];
  bottomPerformers: BenchmarkPerAgreementResult[];
  failureAnalysis: Array<{
    agreementId: string;
    overallScore: number;
    missingParties: string[];
    missingRevenueSplits: string[];
    missingObligations: number;
    missingRisks: number;
    missingClauses: number;
  }>;
  categorySummaries: Record<AgreementBenchmarkCategory, BenchmarkCategorySummary>;
  difficultySummaries: Record<AgreementBenchmarkDifficulty, BenchmarkCategorySummary>;
};
export type EvaluationReport = {
  generatedAt: string;
  samplesDirectory: string;
  agreements: AgreementEvaluationResult[];
  summary: {
    evaluatedCount: number;
    missingActualCount: number;
    averageRelationshipClassification: number;
    averageParties: number;
    averageRevenueSplits: number;
    averageObligations: number;
    averageRisks: number;
    averageMissingClauses: number;
    averageOverall: number;
  };
};
