/**
 * Earning-source abstraction for Referral Management relationships.
 *
 * Internal catalogue services remain the default. External platforms (Weso and
 * future app stores / marketplaces) are stored on the participant payload so
 * later webhook attribution can resolve: external event → affiliate → commission.
 */

export const REFERRAL_EARNING_SOURCE_TYPES = ['internal_service', 'external'] as const;
export type ReferralEarningSourceType = (typeof REFERRAL_EARNING_SOURCE_TYPES)[number];

export const REFERRAL_ATTRIBUTION_METHODS = [
  'discount_code',
  'referral_link',
  'promo_code',
  'other',
] as const;
export type ReferralAttributionMethod = (typeof REFERRAL_ATTRIBUTION_METHODS)[number];

export const ATTRIBUTION_METHOD_LABELS: Record<ReferralAttributionMethod, string> = {
  discount_code: 'Discount code',
  referral_link: 'Referral link',
  promo_code: 'Promo code',
  other: 'Other',
};

export type KnownExternalPlatform = {
  id: string;
  displayName: string;
  aliases: readonly string[];
  suggestedServiceLabel: string;
  suggestedIntegration: string;
};

/** Extensible registry — add future platforms here without a Weso-only workflow. */
export const KNOWN_EXTERNAL_PLATFORMS: readonly KnownExternalPlatform[] = [
  {
    id: 'weso',
    displayName: 'Weso',
    aliases: ['weso'],
    suggestedServiceLabel: 'Weso App Store',
    suggestedIntegration: 'Weso API / webhook',
  },
];

export type ReferralEarningSource = {
  type: ReferralEarningSourceType;
  catalogueServiceIds?: string[];
  externalProvider?: string | null;
  externalService?: string | null;
  attributionMethod?: ReferralAttributionMethod | null;
  /** Future mapping key, e.g. Weso discount code WESO-JANE10. Not required at confirm. */
  externalIdentifier?: string | null;
  integration?: string | null;
  metadata?: {
    providerLabel?: string;
    serviceLabel?: string;
    [key: string]: unknown;
  };
};

export type ReferralEarningSourceInput = {
  type?: ReferralEarningSourceType;
  externalProvider?: string | null;
  externalService?: string | null;
  attributionMethod?: ReferralAttributionMethod | null;
  externalIdentifier?: string | null;
  integration?: string | null;
  /** Audience-facing discount evidenced in the conversation, if any. Never invented. */
  audienceDiscountPct?: number | null;
};

export type ExtractedReferralEarningSource = {
  type: ReferralEarningSourceType | null;
  externalPlatform: string | null;
  externalService: string | null;
  attributionMethod: ReferralAttributionMethod | null;
};

const DISCOUNT_CODE_RE = /\b(discount\s*codes?|promo\s*codes?|coupon\s*codes?|unique discount)\b/i;
const REFERRAL_LINK_RE = /\breferral\s+links?\b/i;
const PROMO_CODE_RE = /\bpromo\s*codes?\b/i;

export function isReferralEarningSourceType(value: unknown): value is ReferralEarningSourceType {
  return value === 'internal_service' || value === 'external';
}

export function isReferralAttributionMethod(value: unknown): value is ReferralAttributionMethod {
  return (
    value === 'discount_code' ||
    value === 'referral_link' ||
    value === 'promo_code' ||
    value === 'other'
  );
}

export function slugifyExternalRef(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function earningSourceTypeOf(
  input: { type?: ReferralEarningSourceType | null } | null | undefined
): ReferralEarningSourceType {
  return input?.type === 'external' ? 'external' : 'internal_service';
}

export function findKnownExternalPlatform(text: string): KnownExternalPlatform | null {
  const haystack = text.toLowerCase();
  for (const platform of KNOWN_EXTERNAL_PLATFORMS) {
    if (platform.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, 'i').test(haystack))) {
      return platform;
    }
  }
  return null;
}

/**
 * Extract an audience/customer discount only when the conversation states one.
 * Does not treat commission / revenue-share percentages as a discount.
 */
export function inferAudienceDiscountPctFromText(text: string): number | null {
  const haystack = text.replace(/\s+/g, ' ');
  const patterns = [
    /\baudience\b[^%]{0,80}?(\d+(?:\.\d+)?)\s*%(?:\s*off|\s*discount)?/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:off|audience discount)\b/i,
    /(\d+(?:\.\d+)?)\s*%\s*discount(?:\s+off)?\b(?![^.]{0,40}(?:commission|revenue\s+share|earn))/i,
  ];
  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (!match?.[1]) continue;
    const pct = Number(match[1]);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) return pct;
  }
  return null;
}

export function inferAttributionMethodFromText(text: string): ReferralAttributionMethod | null {
  if (DISCOUNT_CODE_RE.test(text)) return 'discount_code';
  if (PROMO_CODE_RE.test(text)) return 'promo_code';
  if (REFERRAL_LINK_RE.test(text)) return 'referral_link';
  return null;
}

export function parseAttributionMethod(value: string | null | undefined): ReferralAttributionMethod | null {
  const raw = (value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (isReferralAttributionMethod(raw)) return raw;
  if (raw.includes('discount')) return 'discount_code';
  if (raw.includes('promo')) return 'promo_code';
  if (raw.includes('referral') && raw.includes('link')) return 'referral_link';
  return null;
}

function evidencedExternalServiceLabel(text: string, platform: KnownExternalPlatform): string | null {
  const name = platform.displayName;
  const appStore = text.match(new RegExp(`${name}\\s+app\\s*store`, 'i'));
  if (appStore) return `${name} App Store`;
  const app = text.match(new RegExp(`${name}\\s+apps?\\b`, 'i'));
  if (app) return `${name} app`;
  return null;
}

export function inferReferralEarningSource(input: {
  evidenceText: string;
  extracted?: ExtractedReferralEarningSource | null;
}): {
  type: ReferralEarningSourceType;
  externalProvider: string | null;
  externalProviderLabel: string | null;
  externalService: string | null;
  attributionMethod: ReferralAttributionMethod | null;
} {
  const extracted = input.extracted;
  const evidence = input.evidenceText;

  const extractedType = extracted?.type ?? null;
  const extractedPlatform = extracted?.externalPlatform?.trim() || null;
  const extractedService = extracted?.externalService?.trim() || null;
  const extractedAttribution = extracted?.attributionMethod ?? null;

  const knownFromExtracted = extractedPlatform ? findKnownExternalPlatform(extractedPlatform) : null;
  const knownFromEvidence = findKnownExternalPlatform(evidence);
  const known = knownFromExtracted ?? knownFromEvidence;

  const providerLabel = known?.displayName ?? extractedPlatform;
  const providerKey = known?.id ?? (extractedPlatform ? slugifyExternalRef(extractedPlatform) : null);

  const serviceFromExtracted = extractedService;
  const serviceFromEvidence = known ? evidencedExternalServiceLabel(evidence, known) : null;
  const externalService = serviceFromExtracted || serviceFromEvidence || null;

  const attributionMethod =
    extractedAttribution ?? inferAttributionMethodFromText(evidence) ?? parseAttributionMethod(extracted?.attributionMethod);

  const isExternal =
    extractedType === 'external' || Boolean(known) || Boolean(extractedPlatform && extractedType !== 'internal_service');

  if (!isExternal) {
    return {
      type: 'internal_service',
      externalProvider: null,
      externalProviderLabel: null,
      externalService: null,
      attributionMethod: null,
    };
  }

  return {
    type: 'external',
    externalProvider: providerKey,
    externalProviderLabel: providerLabel,
    externalService,
    attributionMethod,
  };
}

function audienceDiscountPctFromSource(
  input: ReferralEarningSourceInput | ReferralEarningSource | null | undefined
): number | undefined {
  const fromInput =
    input && 'audienceDiscountPct' in input ? input.audienceDiscountPct : undefined;
  const fromMetadata = input && 'metadata' in input ? input.metadata?.audienceDiscountPct : undefined;
  const raw = fromInput ?? fromMetadata;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw <= 100) return raw;
  return undefined;
}

export function normalizeReferralEarningSource(
  input: ReferralEarningSourceInput | ReferralEarningSource | null | undefined,
  catalogueServiceIds: string[] = []
): ReferralEarningSource {
  const type = earningSourceTypeOf(input);
  const audienceDiscountPct = audienceDiscountPctFromSource(input);

  if (type === 'internal_service') {
    return {
      type: 'internal_service',
      catalogueServiceIds,
      metadata: audienceDiscountPct != null ? { audienceDiscountPct } : undefined,
    };
  }

  const providerLabel = input?.externalProvider?.trim() || '';
  const known = providerLabel ? findKnownExternalPlatform(providerLabel) : null;
  const providerKey = known?.id ?? (providerLabel ? slugifyExternalRef(providerLabel) : null);
  const serviceLabel = input?.externalService?.trim() || '';
  const serviceKey = serviceLabel ? slugifyExternalRef(serviceLabel) : null;

  return {
    type: 'external',
    catalogueServiceIds: [],
    externalProvider: providerKey,
    externalService: serviceKey,
    attributionMethod: input?.attributionMethod ?? null,
    externalIdentifier: input?.externalIdentifier?.trim() || null,
    integration: input?.integration?.trim() || null,
    metadata: {
      providerLabel: known?.displayName ?? (providerLabel || undefined),
      serviceLabel: serviceLabel || undefined,
      ...(audienceDiscountPct != null ? { audienceDiscountPct } : {}),
    },
  };
}

export function formatEarningSourceDestination(source: ReferralEarningSource | null | undefined): string | null {
  if (!source || source.type !== 'external') return null;
  const provider = source.metadata?.providerLabel?.trim() || source.externalProvider?.trim() || null;
  const service = source.metadata?.serviceLabel?.trim() || source.externalService?.trim() || null;
  if (provider && service && service.toLowerCase() !== provider.toLowerCase()) {
    return `${provider} · ${service}`;
  }
  return service || provider;
}

export function validateExternalEarningSource(input: ReferralEarningSourceInput | null | undefined): string | null {
  const provider = input?.externalProvider?.trim();
  if (!provider) {
    return 'Enter the external platform this affiliate earns on.';
  }
  return null;
}

export function participantEarningSource(
  participant: { earningSource?: ReferralEarningSource | null } | null | undefined
): ReferralEarningSource | null {
  const source = participant?.earningSource;
  if (!source || typeof source !== 'object') return null;
  if (source.type !== 'internal_service' && source.type !== 'external') return null;
  return source;
}

export function isExternalEarningSourceParticipant(
  participant: { earningSource?: ReferralEarningSource | null } | null | undefined
): boolean {
  return participantEarningSource(participant)?.type === 'external';
}
