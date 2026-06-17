import { z } from 'zod';

import {
  LEAD_PRIORITY_BANDS,
  LEAD_RECOMMENDED_USE_CASES,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-types';

export const AGREEMENT_EXTRACTION_MODEL =
  process.env.AGREEMENT_EXTRACTION_MODEL?.trim() || 'gpt-4o';
export const AGREEMENT_VISION_MODEL =
  process.env.AGREEMENT_VISION_MODEL?.trim() || AGREEMENT_EXTRACTION_MODEL;

export const AgreementExtractionResultSchema = z.object({
  documentType: z.string(),
  parties: z.array(z.unknown()),
  roles: z.array(z.unknown()),
  revenueSplits: z.array(z.unknown()),
  paymentConditions: z.array(z.unknown()),
  obligations: z.array(z.unknown()),
  risks: z.array(z.unknown()),
  missingInformation: z.array(z.unknown()),
  confidenceScore: z.number().min(0).max(1),
});

export type AgreementExtractionResult = z.infer<typeof AgreementExtractionResultSchema>;

export const AgreementExecutiveSummarySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  keyFindings: z.array(z.string()),
  operationalImpact: z.string(),
});

export type AgreementExecutiveSummary = z.infer<typeof AgreementExecutiveSummarySchema>;

export const AgreementSettlementSimulationParticipantSchema = z.object({
  party: z.string(),
  percentage: z.number().optional(),
  fixedAmount: z.number().optional(),
  estimatedPayout: z.number(),
  basis: z.string().optional(),
});

export const AgreementSettlementSimulationSchema = z.object({
  supported: z.boolean(),
  simulationRevenue: z.number(),
  participants: z.array(AgreementSettlementSimulationParticipantSchema),
  notes: z.array(z.string()).optional(),
});

export type AgreementSettlementSimulationParticipant = z.infer<
  typeof AgreementSettlementSimulationParticipantSchema
>;
export type AgreementSettlementSimulation = z.infer<typeof AgreementSettlementSimulationSchema>;

export const AgreementProvvypayFitSignalsSchema = z.object({
  revenueShareDetected: z.boolean(),
  hospitalityDetected: z.boolean(),
  eventDetected: z.boolean(),
  accountantDetected: z.boolean(),
  multiPartyDetected: z.boolean(),
});

export const AgreementProvvypayFitSchema = z.object({
  fitScore: z.number(),
  priorityBand: z.enum(LEAD_PRIORITY_BANDS),
  fitLabel: z.string(),
  recommendedUseCase: z.enum(LEAD_RECOMMENDED_USE_CASES),
  settlementComplexityScore: z.number(),
  headline: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  considerations: z.array(z.string()).optional(),
  signals: AgreementProvvypayFitSignalsSchema,
});

export type AgreementProvvypayFit = z.infer<typeof AgreementProvvypayFitSchema>;

export const SETTLEMENT_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export const AgreementSettlementRiskAssessmentSchema = z.object({
  riskScore: z.number(),
  riskLevel: z.enum(SETTLEMENT_RISK_LEVELS),
  issueCount: z.number(),
  issues: z.array(z.string()),
  potentialImpact: z.string(),
  recommendation: z.string(),
});

export type AgreementSettlementRiskLevel = (typeof SETTLEMENT_RISK_LEVELS)[number];
export type AgreementSettlementRiskAssessment = z.infer<
  typeof AgreementSettlementRiskAssessmentSchema
>;

export type AgreementReportJson = {
  parties: unknown[];
  revenueSplits: unknown[];
  paymentConditions: unknown[];
  obligations: unknown[];
  risks: unknown[];
  missingInformation: unknown[];
  settlementReadiness: AgreementSettlementReadiness;
  executiveSummary?: AgreementExecutiveSummary;
  settlementSimulation?: AgreementSettlementSimulation;
  provvypayFit?: AgreementProvvypayFit;
  settlementRiskAssessment?: AgreementSettlementRiskAssessment;
};

export type AgreementSettlementReadiness = {
  score: number;
  summary: string;
  factors: string[];
};

export type AgreementExtractionFailureJson = {
  success: false;
  error: string;
  stage:
    | 'load_file'
    | 'text_extraction'
    | 'normalization'
    | 'openai_extraction'
    | 'persistence'
    | 'watchdog';
};

export type DocumentTextExtractionResult =
  | { kind: 'text'; text: string }
  | { kind: 'image'; text: string; modelName: string };

export function isAgreementImageMime(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg';
}
