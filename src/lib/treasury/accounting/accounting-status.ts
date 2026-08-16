import type { TreasuryEventStatus } from '@prisma/client';
import type { AccountingDisplayStatus } from '@/lib/treasury/accounting/types';

export function treasuryStatusRequiresReview(status: TreasuryEventStatus | string): boolean {
  return status === 'UNKNOWN' || status === 'INFERRED' || status === 'EXCEPTION';
}

export function accountingStatusForTreasuryEvent(
  status: TreasuryEventStatus | string,
  options?: { isFee?: boolean; isAudWithdrawal?: boolean; hasConfirmedBank?: boolean }
): AccountingDisplayStatus {
  if (options?.isAudWithdrawal && !options.hasConfirmedBank) {
    return 'awaiting_bank_confirmation';
  }
  if (options?.isFee) {
    return status === 'CONFIRMED' ? 'requires_review' : 'requires_review';
  }
  if (status === 'EXCEPTION') return 'requires_review';
  if (status === 'UNKNOWN' || status === 'INFERRED') return 'requires_review';
  if (status === 'CONFIRMED') return 'observed';
  return 'not_applicable';
}

export function accountingStatusLabel(status: AccountingDisplayStatus): string {
  switch (status) {
    case 'posted_to_xero':
      return 'Posted to Xero';
    case 'observed':
      return 'Observed';
    case 'requires_review':
      return 'Requires review';
    case 'awaiting_bank_confirmation':
      return 'Awaiting bank confirmation';
    default:
      return 'Not applicable';
  }
}

export function accountingStatusBadgeClass(status: AccountingDisplayStatus): string {
  switch (status) {
    case 'posted_to_xero':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'observed':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
    case 'requires_review':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'awaiting_bank_confirmation':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200';
    default:
      return 'bg-secondary text-ink-soft';
  }
}

export function xeroSyncToAccountingStatus(
  syncStatus: string | null | undefined
): AccountingDisplayStatus {
  if (syncStatus === 'SUCCESS') return 'posted_to_xero';
  if (syncStatus === 'FAILED' || syncStatus === 'RETRYING') return 'requires_review';
  if (syncStatus === 'PENDING') return 'requires_review';
  return 'not_applicable';
}
