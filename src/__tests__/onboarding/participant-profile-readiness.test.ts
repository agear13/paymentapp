import { describe, expect, it } from '@jest/globals';
import {
  buildInsightsFromTemplate,
  rebuildInsightFromParticipants,
} from '@/lib/onboarding/agreement-intelligence-insights';
import {
  computeProfileReadinessScore,
  derivePotentialGapsFromProfiles,
  deriveParticipantProfileStatus,
  formatDefaultCommercialTerm,
  interpretParticipantNotes,
  templateParticipantPlaceholderName,
} from '@/lib/onboarding/participant-profile-readiness';
import {
  buildDisplayCommercialTerms,
  deriveReadinessWinMessage,
  deriveTemplateSetupProgress,
  formatTemplateCommercialTerm,
  hasCustomisedParticipantNames,
  isPlaceholderParticipantName,
} from '@/lib/onboarding/template-draft-state';
const baseParticipant = (overrides: Record<string, unknown> = {}) => ({
  name: 'Participant 1',
  email: '',
  role: 'Partner',
  ...overrides,
});

describe('participant profile readiness', () => {
  it('uses neutral placeholder participant names', () => {
    expect(templateParticipantPlaceholderName(0)).toBe('Participant 1');
    expect(isPlaceholderParticipantName('Participant 2')).toBe(true);
    expect(isPlaceholderParticipantName('Sarah')).toBe(false);
  });

  it('prefixes default commercial terms only when untouched', () => {
    expect(formatDefaultCommercialTerm('15% Revenue Share')).toBe('Default: 15% Revenue Share');
    const edited = formatTemplateCommercialTerm('15% Revenue Share', '18% Revenue Share');
    expect(edited.display).toBe('18% Revenue Share');
    expect(edited.isUntouchedDefault).toBe(false);
  });

  it('interprets notes for Wise and tax pending', () => {
    const wise = interpretParticipantNotes('Pays monthly via Wise');
    expect(wise.inferredPaymentMethod).toBe('manual');

    const tax = interpretParticipantNotes('ABN supplied separately');
    expect(tax.taxStatus).toBe('supplied_separately');
  });

  it('updates profile status when email and payment method are provided', () => {
    const empty = deriveParticipantProfileStatus(baseParticipant());
    expect(empty.contactable).toBe(false);
    expect(empty.paymentWarning).toBe(true);

    const filled = deriveParticipantProfileStatus(
      baseParticipant({ email: 'a@example.com', preferredPaymentMethod: 'bank_account' })
    );
    expect(filled.contactable).toBe(true);
    expect(filled.paymentLabel).toContain('Bank transfer');
    expect(filled.paymentWarning).toBe(false);
  });

  it('recalculates readiness when participant details improve', () => {
    const sparse = computeProfileReadinessScore({
      participants: [baseParticipant()],
      typeConfidence: 72,
      termsCount: 4,
      obligationsCount: 3,
      usedExtraction: false,
    });
    const improved = computeProfileReadinessScore({
      participants: [
        baseParticipant({
          email: 'partner@example.com',
          preferredPaymentMethod: 'stripe_connect',
          taxIdentifier: '12 345 678 901',
        }),
      ],
      typeConfidence: 72,
      termsCount: 4,
      obligationsCount: 3,
      usedExtraction: false,
    });
    expect(improved).toBeGreaterThan(sparse);
  });

  it('derives responsive gaps from profiles', () => {
    const gaps = derivePotentialGapsFromProfiles([baseParticipant()], {
      includeInfrastructure: false,
    });
    expect(gaps.some((g) => g.includes('email'))).toBe(true);

    const resolved = derivePotentialGapsFromProfiles(
      [
        baseParticipant({
          email: 'a@example.com',
          preferredPaymentMethod: 'revenue_share_only',
          taxIdentifier: '123',
        }),
      ],
      { includeInfrastructure: false }
    );
    expect(resolved.some((g) => g.includes('email'))).toBe(false);
    expect(resolved.some((g) => g.includes('Tax'))).toBe(false);
  });
});

describe('template draft state', () => {
  it('tracks setup progress separately from readiness', () => {
    const progress = deriveTemplateSetupProgress({
      participants: [{ name: 'Sarah', email: 's@example.com', role: 'Partner' }],
      commercialTerms: ['15% Revenue Share'],
      originalCommercialTerms: ['15% Revenue Share'],
    });
    expect(progress.participantsComplete).toBe(true);
    expect(progress.commercialTermsComplete).toBe(false);
    expect(progress.settlementRulesComplete).toBe(false);
  });

  it('detects readiness win messages', () => {
    const before = [baseParticipant()];
    const after = [baseParticipant({ email: 's@example.com' })];
    expect(deriveReadinessWinMessage(before, after, 60, 68)).toBe('Email added');
  });

  it('removes default prefix once commercial terms are edited', () => {
    const display = buildDisplayCommercialTerms(
      ['15% Revenue Share', 'Monthly Settlement'],
      ['18% Revenue Share', 'Monthly Settlement']
    );
    expect(display[0]).toBe('18% Revenue Share');
    expect(display[1]).toMatch(/^Default:/);
  });
});

describe('template agreement insights', () => {
  const templateParticipants = [
    { name: 'Participant 1', email: '', role: 'Partner' as const },
    { name: 'Participant 2', email: '', role: 'Partner' as const },
  ];

  it('marks unconfirmed template insights as drafts with default terms', () => {
    const draft = buildInsightsFromTemplate('revenue_share', templateParticipants);
    expect(draft.isTemplateDraft).toBe(true);
    expect(draft.commercialTermsFound.every((t) => /^Default:/i.test(t))).toBe(true);
    expect(draft.readinessExplanation).toMatch(/starting point|Keep going|Almost there/i);
  });

  it('confirms template insights without default prefix on edited terms', () => {
    const template = ['15% Revenue Share', 'Net Sales Basis', 'Monthly Settlement', 'Settlement Within 10 Days'];
    const confirmed = buildInsightsFromTemplate('revenue_share', templateParticipants, {
      confirmed: true,
      commercialTerms: ['18% Revenue Share', 'Net Sales Basis', 'Monthly Settlement', 'Settlement Within 10 Days'],
      originalCommercialTerms: template,
    });
    expect(confirmed.isTemplateDraft).toBe(false);
    expect(confirmed.isCustomisedDraft).toBe(true);
    expect(confirmed.commercialTermsFound[0]).toBe('18% Revenue Share');
    expect(confirmed.commercialTermsFound[0]).not.toMatch(/^Default:/);
  });

  it('uses participant names throughout the insight', () => {
    const customised = buildInsightsFromTemplate(
      'revenue_share',
      [
        { name: 'Sarah', email: 's@example.com', role: 'Partner', preferredPaymentMethod: 'bank_account' },
        { name: 'James', email: 'j@example.com', role: 'Partner', preferredPaymentMethod: 'stripe_connect' },
      ],
      { confirmed: true, commercialTerms: ['15% Revenue Share'], originalCommercialTerms: ['15% Revenue Share'] }
    );
    expect(hasCustomisedParticipantNames(customised.participantsFound.map((p) => ({ name: p.name, email: '', role: 'Partner' as const })))).toBe(true);
    expect(customised.participantsFound.map((p) => p.name)).toEqual(['Sarah', 'James']);
  });

  it('rebuilds template insight from edited participants', () => {
    const initial = buildInsightsFromTemplate('revenue_share', templateParticipants, {
      confirmed: true,
      commercialTerms: ['15% Revenue Share'],
      originalCommercialTerms: ['15% Revenue Share'],
    });
    const updated = rebuildInsightFromParticipants(initial, [
      {
        name: 'Coastal Events',
        email: 'ops@coastal.example',
        role: 'Partner',
        preferredPaymentMethod: 'bank_account',
      },
      {
        name: 'Island Promotions',
        email: 'promo@island.example',
        role: 'Promoter',
        preferredPaymentMethod: 'stripe_connect',
        taxIdentifier: '98 765 432 109',
      },
    ]);
    expect(updated.participantsFound[0]?.name).toBe('Coastal Events');
    expect(updated.readinessScore).toBeGreaterThan(initial.readinessScore);
  });
});
