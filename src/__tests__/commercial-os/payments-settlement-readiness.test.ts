import { buildPaymentsSetupReadiness } from '@/lib/commercial-os/payments-settlement-readiness';

describe('payments settlement readiness', () => {
  it('marks required steps from activation and merchant rails', () => {
    const result = buildPaymentsSetupReadiness({
      activation: {
        workspaceCreated: true,
        projectCreated: true,
        participantCount: 2,
        participantsConfigured: false,
        participantsConfiguredCount: 0,
        obligationsCreated: false,
        obligationCount: 0,
        revenueConfigured: false,
        providerConnected: false,
        payoutMethodConfigured: false,
        releaseEligible: false,
        releaseEligibleCount: 0,
        firstReleaseCompleted: false,
        onboardingCompleted: false,
        defaultCurrency: 'AUD',
        onboardingProgressPercent: 40,
        phase: 'setup_in_progress',
        phaseLabel: 'Setup in progress',
        checklist: [],
        activationBlockers: [],
        setupWarnings: [],
        primaryProjectId: null,
        needsGuidance: true,
      },
      railSetup: {
        multiRails: {
          stripe: { configured: true, incomplete: false },
          hedera: { configured: false, incomplete: false },
          evm_wallet: { configured: false, incomplete: false },
          wise: { configured: false, incomplete: false },
        },
        anyRailConfigured: true,
        readyForPaymentRequests: true,
      },
      brandingConfigured: true,
      accountingConnected: false,
      manualBankConfigured: false,
    });

    expect(result.checklist.find((c) => c.id === 'branding')?.done).toBe(true);
    expect(result.checklist.find((c) => c.id === 'provider')?.done).toBe(true);
    expect(result.checklist.find((c) => c.id === 'earnings')?.done).toBe(false);
    expect(result.requiredDone).toBe(false);
  });
});
