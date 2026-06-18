import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type {
  ExtractionConfidence,
  ExtractionResult,
  ExtractorEntryPoint,
  MilestoneCategory,
  ParticipationModelOption,
  SourceType,
} from './extraction-types';
import { resolveReviewFormCurrency } from '@/lib/currency/resolve-review-form-currency';
import { PLATFORM_FALLBACK_CURRENCY } from '@/lib/currency/resolve-catalog-default-currency';
import {
  extractedCurrencyDisplayCode,
  isExtractedCurrencyExplicitlyUnsupported,
} from '@/lib/ai-extractor/extraction-currency';
// Import from the currency domain leaf to break the extraction-currency ↔
// review-form-types circular dependency. Re-exported so existing callers don't
// need to update their import paths.
import {
  SUPPORTED_PROJECT_CURRENCIES,
  isSupportedCurrency,
} from '@/lib/ai-extractor/currency/supported-currencies';
export {
  SUPPORTED_PROJECT_CURRENCIES,
  type SupportedProjectCurrency,
  isSupportedCurrency,
} from '@/lib/ai-extractor/currency/supported-currencies';
import { deliverableDescriptions } from '@/lib/ai-extractor/parse-deliverables';

export interface ReviewedMilestone {
  description: string;
  deadline: string;
  category: MilestoneCategory;
}

export interface ReviewedParty {
  id: string;
  name: string;
  email: string;
  role: string;
  participationModel: ParticipationModelOption;
  fixedAmount: number | null;
  revenueSharePct: number | null;
  deliverables: string[];
  milestones: ReviewedMilestone[];
  notes: string;
}

export interface ReviewFormState {
  entryPoint: ExtractorEntryPoint;
  existingDealId: string | undefined;
  sourceType: SourceType;
  projectName: string;
  projectDescription: string;
  projectValue: number | null;
  currency: string;
  counterparty: string;
  parties: ReviewedParty[];
  /** Keyed by ReviewedParty.id — only populated for Entry Point B when duplicates detected. */
  duplicateResolutions: Record<string, 'update' | 'create'>;
  /** Original conversation text pasted by the operator. Stored on the deal for permanent audit access. */
  rawConversationText?: string;
  /** ISO code from extraction when explicitly stated (may be unsupported). */
  extractedCurrencyCode: string | null;
  /** When true, fixed amounts are withheld until operator enters AUD/USD equivalents. */
  extractedCurrencyUnsupported: boolean;
  /** Extraction confidence for project currency — used for confirmed/assumed UI. */
  currencyConfidence: ExtractionConfidence;
}

export function reviewFormFromExtraction(
  result: ExtractionResult,
  entryPoint: ExtractorEntryPoint,
  sourceType: SourceType,
  existingDealId?: string,
  context?: {
    project?: Pick<RecentDeal, 'projectValueCurrency'> | null;
    workspaceCurrency?: string | null;
  }
): ReviewFormState {
  const extractedCurrency = result.currency.value;
  const extractedCurrencyUnsupported = isExtractedCurrencyExplicitlyUnsupported(
    result.currency
  );
  const extractedCurrencyCode = extractedCurrencyDisplayCode(result.currency);
  const resolvedCurrency = resolveReviewFormCurrency({
    extractedCurrency,
    extractedConfidence: result.currency.confidence,
    project: context?.project ?? null,
    workspaceCurrency: context?.workspaceCurrency,
  });
  const operationalCurrency = isSupportedCurrency(resolvedCurrency)
    ? resolvedCurrency
    : PLATFORM_FALLBACK_CURRENCY;

  // Null fixed amounts when extraction named an unsupported ISO currency — do not
  // treat workspace AUD/USD fallback as permission to store IDR-scale numbers as AUD.
  // Revenue share % is currency-neutral and is preserved.
  return {
    entryPoint,
    existingDealId,
    sourceType,
    projectName: result.projectName.value ?? '',
    projectDescription: result.projectDescription.value ?? '',
    projectValue: extractedCurrencyUnsupported
      ? null
      : result.projectValue.value,
    currency: operationalCurrency,
    counterparty: result.counterparty.value ?? '',
    parties: result.parties.map((p) => ({
      id: p.id,
      name: p.name.value,
      email: p.email.value ?? '',
      role: p.role.value,
      participationModel: p.participationModel.value,
      fixedAmount: extractedCurrencyUnsupported ? null : p.fixedAmount.value,
      revenueSharePct: p.revenueSharePct.value,
      deliverables: deliverableDescriptions(p),
      milestones: (p.milestones ?? []).map((m) => ({
        description: m.description.value,
        deadline: m.deadline.value ?? '',
        category: m.category.value,
      })),
      notes: p.notes.value ?? '',
    })),
    duplicateResolutions: {},
    rawConversationText: undefined,
    extractedCurrencyCode,
    extractedCurrencyUnsupported,
    currencyConfidence: result.currency.confidence,
  };
}