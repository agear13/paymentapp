import { z } from 'zod';

import type { AgreementReportStatus } from '@prisma/client';
import {
  AgreementExecutiveSummarySchema,
  AgreementProvvypayFitSchema,
  AgreementSettlementRiskAssessmentSchema,
  AgreementSettlementSimulationSchema,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

export const AgreementSettlementReadinessSchema = z.object({
  score: z.number(),
  summary: z.string(),
  factors: z.array(z.string()),
});

export const AgreementReportJsonSchema = z.object({
  parties: z.array(z.unknown()),
  revenueSplits: z.array(z.unknown()),
  paymentConditions: z.array(z.unknown()),
  obligations: z.array(z.unknown()),
  risks: z.array(z.unknown()),
  missingInformation: z.array(z.unknown()),
  settlementReadiness: AgreementSettlementReadinessSchema,
  executiveSummary: AgreementExecutiveSummarySchema.optional(),
  settlementSimulation: AgreementSettlementSimulationSchema.optional(),
  provvypayFit: AgreementProvvypayFitSchema.optional(),
  settlementRiskAssessment: AgreementSettlementRiskAssessmentSchema.optional(),
});

export type PublicAgreementReportJson = z.infer<typeof AgreementReportJsonSchema>;

export type PublicObligationReportDemoBooking = {
  url: string;
  leadId: string;
  reportId: string;
  overallScore: number | null;
  priorityBand: string | null;
  recommendedUseCase: string | null;
};

export type PublicObligationReportPayload = {
  status: AgreementReportStatus;
  reportAccessToken: string;
  createdAt: string;
  viewedAt: string | null;
  settlementReadinessScore: number | null;
  document: {
    filename: string;
    companyName: string | null;
    businessType: string | null;
  };
  report: PublicAgreementReportJson | null;
  failureMessage: string | null;
  demoBooking: PublicObligationReportDemoBooking | null;
};

export function isValidReportAccessToken(token: string): boolean {
  return /^rpt_[a-z0-9]{10}$/.test(token.trim());
}

export function parsePublicReportJson(value: unknown): PublicAgreementReportJson | null {
  const parsed = AgreementReportJsonSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
