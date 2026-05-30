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
}

export function reviewFormFromExtraction(
  result: ExtractionResult,
  entryPoint: ExtractorEntryPoint,
  sourceType: SourceType,
  existingDealId?: string
): ReviewFormState {
  return {
    entryPoint,
    existingDealId,
    sourceType,
    projectName: result.projectName.value ?? '',
    projectDescription: result.projectDescription.value ?? '',
    projectValue: result.projectValue.value,
    currency: result.currency.value || 'AUD',
    counterparty: result.counterparty.value ?? '',
    parties: result.parties.map((p) => ({
      id: p.id,
      name: p.name.value,
      email: p.email.value ?? '',
      role: p.role.value,
      participationModel: p.participationModel.value,
      fixedAmount: p.fixedAmount.value,
      revenueSharePct: p.revenueSharePct.value,
      notes: p.notes.value ?? '',
    })),
    duplicateResolutions: {},
  };
}