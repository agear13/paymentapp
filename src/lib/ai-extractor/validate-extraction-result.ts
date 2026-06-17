import { z } from 'zod';
import type {
  ExtractedParty,
  ExtractedPaymentTerm,
  ExtractionResult,
  ExtractionUncertainty,
} from './extraction-types';
import {
  FlexibleExtractionFieldSchema,
  logExtractorDebugSnapshot,
} from './extraction-field-schema';
import { parseArrayItemsNonBlocking } from './parse-array-non-blocking';
import { parseConditionalPaymentsNonBlocking } from './parse-conditional-payments';
import { parseDeliverablesNonBlocking } from './parse-deliverables';
import { parseSettlementEventsNonBlocking } from './parse-settlement-events';
import { parseSettlementRulesNonBlocking } from './parse-settlement-rules';
import {
  parseAgreementOwnerNonBlocking,
  parseCommercialDependenciesNonBlocking,
  parseCompensationTermsNonBlocking,
  parseOperationalObligationsNonBlocking,
} from './parse-commercial-graph';
import { normalizeServiceCategories } from './service-category';

const F = FlexibleExtractionFieldSchema;

const ABSENT_STRING = { value: null, confidence: 'absent' as const };
const ABSENT_NUMBER = { value: null, confidence: 'absent' as const };
const EMPTY_STRING_LIST = { value: [] as string[], confidence: 'absent' as const };

const ObligationStatusSchema = z.enum([
  'draft',
  'confirmed',
  'pending',
  'conditional',
  'fulfilled',
  'disputed',
]);

const ConfidenceSchema = z.enum(['high', 'medium', 'low', 'absent']);

const MilestoneSchema = z.object({
  description: F(z.string()),
  deadline: F(z.string().nullable()),
  category: F(z.enum(['financial', 'performance'])),
  status: ObligationStatusSchema.optional(),
});

const ConditionSchema = z.object({
  description: F(z.string()),
  dependsOn: F(z.string().nullable()),
  status: ObligationStatusSchema.optional(),
});

const DependencySchema = z.object({
  obligation: F(z.string()),
  dependsOn: F(z.string()),
  status: ObligationStatusSchema.optional(),
});

const CorePartySchema = z.object({
  id: z.string(),
  name: F(z.string()),
  email: F(z.string().nullable()).optional(),
  role: F(z.string()),
  participationModel: F(
    z.enum(['fixed_payout', 'revenue_share', 'hybrid', 'customer_attribution'])
  ),
  fixedAmount: F(z.number().nullable()),
  revenueSharePct: F(z.number().nullable()),
  notes: F(z.string().nullable()).optional(),
});

const PaymentTermSchema = z.object({
  description: F(z.string()),
  amount: F(z.number().nullable()),
  currency: F(z.string().nullable()),
  dueCondition: F(z.string().nullable()),
});

const ProjectFieldsSchema = z.object({
  projectName: F(z.string().nullable()),
  projectDescription: F(z.string().nullable()),
  projectValue: F(z.number().nullable()),
  currency: F(z.string().nullable()),
  counterparty: F(z.string().nullable()),
});

const UncertaintySchema = z.object({
  field: z.string(),
  issue: z.string(),
  snippet: z.string().nullable().optional(),
});

function countArray(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

function parseFieldWithFallback<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  fallback: T,
  label: string
): T {
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  console.error(`[ai-extractor] Using fallback for ${label}:`, JSON.stringify(result.error.issues));
  return fallback;
}

function parseParty(raw: unknown): {
  party: ExtractedParty | null;
  droppedOptional: string[];
} {
  const core = CorePartySchema.safeParse(raw);
  if (!core.success) {
    console.error(
      '[ai-extractor] Dropped invalid party (core fields):',
      JSON.stringify(core.error.issues)
    );
    return { party: null, droppedOptional: ['party'] };
  }

  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const droppedOptional: string[] = [];

  const deliverablesParsed = parseDeliverablesNonBlocking(obj.deliverables);
  if (deliverablesParsed.droppedCount > 0) {
    droppedOptional.push(`deliverables(${deliverablesParsed.droppedCount})`);
  }

  const deliverablesLegacy = parseFieldWithFallback(
    F(z.array(z.string())),
    obj.deliverables,
    EMPTY_STRING_LIST,
    'party.deliverablesLegacy'
  );

  const conditionalPayments = parseConditionalPaymentsNonBlocking(obj.conditionalPayments);
  if (conditionalPayments.droppedCount > 0) {
    droppedOptional.push(`conditionalPayments(${conditionalPayments.droppedCount})`);
  }

  const milestones = parseArrayItemsNonBlocking(MilestoneSchema, obj.milestones, 'milestone');
  if (milestones.droppedCount > 0) {
    droppedOptional.push(`milestones(${milestones.droppedCount})`);
  }

  const conditions = parseArrayItemsNonBlocking(ConditionSchema, obj.conditions, 'condition');
  if (conditions.droppedCount > 0) {
    droppedOptional.push(`conditions(${conditions.droppedCount})`);
  }

  const dependencies = parseArrayItemsNonBlocking(
    DependencySchema,
    obj.dependencies,
    'dependency'
  );
  if (dependencies.droppedCount > 0) {
    droppedOptional.push(`dependencies(${dependencies.droppedCount})`);
  }

  const serviceCategoriesRaw = parseFieldWithFallback(
    F(z.array(z.string())),
    obj.serviceCategories,
    EMPTY_STRING_LIST,
    'party.serviceCategories'
  );

  const compensationTerms = parseCompensationTermsNonBlocking(obj.compensationTerms);
  if (compensationTerms.droppedCount > 0) {
    droppedOptional.push(`compensationTerms(${compensationTerms.droppedCount})`);
  }

  const operationalObligations = parseOperationalObligationsNonBlocking(obj.operationalObligations);
  if (operationalObligations.droppedCount > 0) {
    droppedOptional.push(`operationalObligations(${operationalObligations.droppedCount})`);
  }

  const commercialDependencies = parseCommercialDependenciesNonBlocking(obj.commercialDependencies);
  if (commercialDependencies.droppedCount > 0) {
    droppedOptional.push(`commercialDependencies(${commercialDependencies.droppedCount})`);
  }

  return {
    party: {
      id: core.data.id,
      name: core.data.name,
      email: core.data.email ?? ABSENT_STRING,
      role: core.data.role,
      participationModel: core.data.participationModel,
      fixedAmount: core.data.fixedAmount,
      revenueSharePct: core.data.revenueSharePct,
      notes: core.data.notes ?? ABSENT_STRING,
      deliverables: deliverablesParsed.items,
      deliverablesLegacy: deliverablesLegacy.value.length > 0 ? deliverablesLegacy : undefined,
      conditionalPayments: conditionalPayments.items,
      milestones: milestones.items,
      conditions: conditions.items,
      dependencies: dependencies.items,
      serviceCategories: {
        value: normalizeServiceCategories(serviceCategoriesRaw.value),
        confidence: serviceCategoriesRaw.confidence,
      },
      ...(compensationTerms.items.length > 0
        ? { compensationTerms: compensationTerms.items }
        : {}),
      ...(operationalObligations.items.length > 0
        ? { operationalObligations: operationalObligations.items }
        : {}),
      ...(commercialDependencies.items.length > 0
        ? { commercialDependencies: commercialDependencies.items }
        : {}),
    },
    droppedOptional,
  };
}

function appendUncertainties(
  base: ExtractionUncertainty[],
  entries: ExtractionUncertainty[]
): ExtractionUncertainty[] {
  if (entries.length === 0) return base;
  return [...base, ...entries];
}

/**
 * Resilient extraction validator. Never throws.
 * Optional enrichment fields that fail validation are dropped with warnings;
 * core project/participant/payment-term data is preserved when salvageable.
 */
export function validateExtractionResult(raw: unknown): ExtractionResult {
  const rawObject =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const rawParticipants = countArray(rawObject.parties);
  const rawPaymentTerms = countArray(rawObject.paymentTerms);

  logExtractorDebugSnapshot({
    rawParticipants,
    rawPaymentTerms,
  });

  const projectFields = parseFieldWithFallback(
    ProjectFieldsSchema,
    rawObject,
    {
      projectName: ABSENT_STRING,
      projectDescription: ABSENT_STRING,
      projectValue: ABSENT_NUMBER,
      currency: ABSENT_STRING,
      counterparty: ABSENT_STRING,
    },
    'project fields'
  );

  const parties: ExtractedParty[] = [];
  const validationUncertainties: ExtractionUncertainty[] = [];
  let droppedParties = 0;

  if (Array.isArray(rawObject.parties)) {
    for (const partyRaw of rawObject.parties) {
      const { party, droppedOptional } = parseParty(partyRaw);
      if (!party) {
        droppedParties += 1;
        continue;
      }
      parties.push(party);
      if (droppedOptional.length > 0) {
        validationUncertainties.push({
          field: `parties.${party.id}`,
          issue: `Dropped invalid optional enrichment: ${droppedOptional.join(', ')}`,
        });
      }
    }
  }

  if (droppedParties > 0) {
    validationUncertainties.push({
      field: 'parties',
      issue: `${droppedParties} participant(s) could not be validated and were omitted.`,
    });
  }

  const paymentTerms: ExtractedPaymentTerm[] = [];
  const paymentTermsResult = parseArrayItemsNonBlocking(
    PaymentTermSchema,
    rawObject.paymentTerms,
    'paymentTerm'
  );
  paymentTerms.push(...paymentTermsResult.items);
  if (paymentTermsResult.droppedCount > 0) {
    validationUncertainties.push({
      field: 'paymentTerms',
      issue: `${paymentTermsResult.droppedCount} payment term(s) could not be validated and were omitted.`,
    });
  }

  const baseUncertainties = parseArrayItemsNonBlocking(
    UncertaintySchema,
    rawObject.uncertainties,
    'uncertainty'
  ).items;

  const { events: settlementEvents, droppedCount: droppedSettlementEvents } =
    parseSettlementEventsNonBlocking(rawObject.settlementEvents);
  if (droppedSettlementEvents > 0) {
    validationUncertainties.push({
      field: 'settlementEvents',
      issue: `${droppedSettlementEvents} settlement event(s) could not be validated and were omitted; obligations were derived from parties instead.`,
    });
  }

  const settlementRules = parseSettlementRulesNonBlocking(rawObject.settlementRules);
  if (settlementRules.droppedCount > 0) {
    validationUncertainties.push({
      field: 'settlementRules',
      issue: `${settlementRules.droppedCount} settlement rule(s) could not be validated and were omitted.`,
    });
  }

  const overallConfidence = parseFieldWithFallback(
    ConfidenceSchema,
    rawObject.overallConfidence,
    'low',
    'overallConfidence'
  );

  const extractedAt =
    typeof rawObject.extractedAt === 'string' && rawObject.extractedAt.trim()
      ? rawObject.extractedAt
      : new Date().toISOString();

  const sourceHint =
    typeof rawObject.sourceHint === 'string' || rawObject.sourceHint === null
      ? rawObject.sourceHint
      : null;

  const schemaVersion = parseFieldWithFallback(
    z.enum(['v1', 'v2', 'v3', 'v4', 'v5']).optional(),
    rawObject.schemaVersion,
    undefined,
    'schemaVersion'
  );

  const agreementOwner = parseAgreementOwnerNonBlocking(rawObject.agreementOwner);

  const result: ExtractionResult = {
    ...projectFields,
    parties,
    paymentTerms,
    ...(settlementRules.items.length > 0 ? { settlementRules: settlementRules.items } : {}),
    ...(settlementEvents.length > 0 ? { settlementEvents } : {}),
    ...(agreementOwner ? { agreementOwner } : {}),
    uncertainties: appendUncertainties(baseUncertainties, validationUncertainties),
    overallConfidence,
    sourceHint,
    extractedAt,
    ...(schemaVersion ? { schemaVersion } : {}),
  };

  logExtractorDebugSnapshot({
    validatedParticipants: result.parties.length,
    validatedPaymentTerms: result.paymentTerms.length,
  });

  return result;
}
