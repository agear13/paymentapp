import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import type { OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';
import {
  buildInsightsFromManual,
  type AgreementIntelligenceInsight,
  type AgreementCreationSource,
} from '@/lib/onboarding/agreement-intelligence-insights';

export const DEMO_AGREEMENT_NAME = 'Beach Festival Partnership';

export const DEMO_PARTICIPANTS: OnboardingDraftParticipant[] = [
  { name: 'Festival Operator', email: '', role: 'Partner' },
  { name: 'Coastal Promotions', email: '', role: 'Promoter' },
];

export const DEMO_USE_CASE: OnboardingUseCaseId = 'event_settlement';

export function buildDemoAgreementInsight(): AgreementIntelligenceInsight {
  const base = buildInsightsFromManual({
    agreementName: DEMO_AGREEMENT_NAME,
    participants: DEMO_PARTICIPANTS,
    description:
      '15% revenue share on net bar sales. Monthly settlement within 10 days. Approval required before release.',
    creationSource: 'explore',
  });

  return {
    ...base,
    agreementType: 'Event Settlement Agreement',
    agreementTypeConfidence: 96,
    commercialTermsFound: [
      '15% Revenue Share',
      'Monthly Settlement',
      'Net Sales Basis',
      'Settlement Within 10 Days',
    ],
    obligationsIdentified: [
      'Revenue must be calculated monthly',
      'Settlement due within 10 days',
      'Revenue share calculated after processing fees',
      'Approval required before release',
    ],
    potentialGaps: [
      'Participant email missing',
      'Settlement account not configured',
      'Payment infrastructure not connected',
    ],
    readinessScore: 96,
    readinessExplanation:
      'This agreement is almost ready for coordination and settlement.',
    usedExtraction: false,
    creationSource: 'explore',
  };
}

export function demoCreationSourceLabel(source: AgreementCreationSource): string {
  switch (source) {
    case 'import':
      return 'Agreement source analyzed successfully.';
    case 'manual':
      return 'Agreement structure configured successfully.';
    case 'template':
      return 'Template customized and ready.';
    case 'explore':
      return 'Demo agreement generated for exploration.';
  }
}
