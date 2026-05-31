import type {
  ExtractionResult,
  ExtractorEntryPoint,
  ParticipationModelOption,
  SourceType,
} from './extraction-types';

export interface ReviewedParty {
  id: string;
  name: string;
  email: string;
  role: string;
  participationModel: ParticipationModelOption;
  fixedAmount: number | null;
  revenueSharePct: number | null;
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
}

/** AUD and USD are the only currencies the system can store and calculate with correctly. */
export const SUPPORTED_PROJECT_CURRENCIES = ['AUD', 'USD'] as const;
export type SupportedProjectCurrency = (typeof SUPPORTED_PROJECT_CURRENCIES)[number];

export function isSupportedCurrency(code: string | null | undefined): code is SupportedProjectCurrency {
  return SUPPORTED_PROJECT_CURRENCIES.includes(code as SupportedProjectCurrency);
}

export function reviewFormFromExtraction(
  result: ExtractionResult,
  entryPoint: ExtractorEntryPoint,
  sourceType: SourceType,
  existingDealId?: string
): ReviewFormState {
  const extractedCurrency = result.currency.value;
  const currencySupported = isSupportedCurrency(extractedCurrency);

  // For unsupported currencies (IDR, SGD, etc.) null out all fixed numeric amounts.
  // Revenue share % is currency-neutral and is preserved. The operator must enter
  // AUD/USD equivalents manually — the original values are shown as reference in the UI.
  return {
    entryPoint,
    existingDealId,
    sourceType,
    projectName: result.projectName.value ?? '',
    projectDescription: result.projectDescription.value ?? '',
    projectValue: currencySupported ? result.projectValue.value : null,
    currency: currencySupported ? extractedCurrency : 'AUD',
    counterparty: result.counterparty.value ?? '',
    parties: result.parties.map((p) => ({
      id: p.id,
      name: p.name.value,
      email: p.email.value ?? '',
      role: p.role.value,
      participationModel: p.participationModel.value,
      fixedAmount: currencySupported ? p.fixedAmount.value : null,
      revenueSharePct: p.revenueSharePct.value,
      notes: p.notes.value ?? '',
    })),
    duplicateResolutions: {},
  };
}