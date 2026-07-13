import { z } from 'zod';

export const YearMonthSchema = z.object({
  year: z.number().int().min(1900).max(3000),
  month: z.number().int().min(1).max(12),
});

export const CommercialTimingFieldsSchema = z.object({
  servicePeriodStart: z.string().datetime().nullable().optional(),
  servicePeriodEnd: z.string().datetime().nullable().optional(),
  recognitionPeriod: YearMonthSchema.nullable().optional(),
  expectedPaymentDate: z.string().datetime().nullable().optional(),
  expectedSettlementDate: z.string().datetime().nullable().optional(),
});

export const AgreementCommercialTimingSchema = CommercialTimingFieldsSchema;

export const DocumentCommercialTimingSchema = CommercialTimingFieldsSchema.extend({
  overrides: CommercialTimingFieldsSchema.partial().nullable().optional(),
});

export const UpdateAgreementCommercialTimingBodySchema = z.object({
  commercialTiming: AgreementCommercialTimingSchema,
});
