import type { RecentDeal } from '@/lib/data/mock-deal-network';

export const PROJECT_DETAILS_NAME_MAX = 255;
export const PROJECT_DETAILS_DESCRIPTION_MAX = 2000;
export const PROJECT_DETAILS_PARTNER_MAX = 255;

export type ProjectDetailsCurrency = 'AUD' | 'USD';

export type ProjectDetailsPatch = {
  dealName: string;
  projectDescription?: string | null;
  partner?: string | null;
  value: number;
  projectValueCurrency?: ProjectDetailsCurrency | null;
  paymentLink?: string | null;
};

export function projectValueIsSpecified(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function formatProjectValueLabel(
  value: number | null | undefined,
  currency: string = 'AUD'
): string {
  if (!projectValueIsSpecified(value)) return 'Not specified';
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value as number);
  } catch {
    return `${currency} ${Math.round(value as number).toLocaleString()}`;
  }
}

export function applyProjectDetailsPatch(
  current: RecentDeal,
  patch: ProjectDetailsPatch
): RecentDeal {
  const dealName = patch.dealName.trim();
  if (!dealName) {
    throw new Error('Project name is required.');
  }
  const description = patch.projectDescription?.trim() || undefined;
  const partner = patch.partner?.trim() || dealName;
  const value =
    typeof patch.value === 'number' && Number.isFinite(patch.value) && patch.value >= 0
      ? patch.value
      : 0;
  const currency =
    patch.projectValueCurrency === 'USD' || patch.projectValueCurrency === 'AUD'
      ? patch.projectValueCurrency
      : current.projectValueCurrency ?? 'AUD';

  return {
    ...current,
    dealName,
    partner,
    value,
    projectDescription: description,
    latestUpdate: description ?? current.latestUpdate,
    projectValueCurrency: currency,
    paymentLink:
      patch.paymentLink === undefined
        ? current.paymentLink
        : patch.paymentLink?.trim() || undefined,
    lastUpdated: new Date().toISOString(),
  };
}
