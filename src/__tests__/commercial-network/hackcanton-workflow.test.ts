/**
 * HackCanton Shared Commercial Agreement — end-to-end tests.
 *
 * Verifies the frozen workflow:
 *   Upload + AI (off-ledger fixtures)
 *   → Platform proposes
 *   → Venue / Promoter / Artist progressive Accept
 *   → Bound CommercialAgreement
 *   → SettlementReady
 *   → Projection into Provvypay read models
 *
 * Accountant is never a ledger party.
 */

import {
  cantonProjectionToOperationsFields,
  createCantonCommercialNetworkProvider,
  createCantonLedgerRuntime,
  createProjectionService,
  HACKCANTON_DEMO,
  openCommercialNetwork,
  runHackCantonDemoWorkflow,
  setCommercialNetworkConfig,
  clearCommercialNetworkConfigs,
  setDefaultCommercialNetworkProviderRegistry,
  createCommercialNetworkProviderRegistry,
  allRequiredAccepted,
} from '@/lib/commercial-network';

describe('HackCanton Shared Commercial Agreement workflow', () => {
  beforeEach(() => {
    clearCommercialNetworkConfigs();
    setDefaultCommercialNetworkProviderRegistry(null);
  });

  it('runs the deterministic demo to SettlementReady with Platform narration', async () => {
    const { projection, stages } = await runHackCantonDemoWorkflow();

    expect(projection.platformDisplayName).toBe('Provvypay Platform');
    expect(projection.stage).toBe('SettlementReady');
    expect(projection.pendingRoles).toEqual([]);
    expect(projection.requiredParticipants.map((r) => r.role).sort()).toEqual([
      'Artist',
      'Promoter',
      'Venue',
    ]);
    expect(projection.requiredParticipants.map((r) => r.role)).not.toContain(
      'Accountant'
    );

    expect(stages[0]).toBe('Proposed');
    expect(stages).toContain('PartiallyBound');
    expect(stages).toContain('Bound');
    expect(stages[stages.length - 1]).toBe('SettlementReady');

    const ops = cantonProjectionToOperationsFields(projection);
    expect(ops.settlementReadiness).toBe(true);
    expect(ops.platformDisplayName).toBe('Provvypay Platform');
    expect(ops.acceptedRoles).toEqual(
      expect.arrayContaining(['Venue', 'Promoter', 'DJ / Artist'])
    );
  });

  it('derives binding from requiredParticipants (not a hard-coded party count)', () => {
    const runtime = createCantonLedgerRuntime({
      now: () => '2026-07-16T12:00:00.000Z',
    });

    const required = [
      { party: 'p1', role: 'Venue' },
      { party: 'p2', role: 'Promoter' },
      { party: 'p3', role: 'Artist' },
      { party: 'p4', role: 'Sponsor' },
    ];

    runtime.createProposal({
      platform: 'platform',
      requiredParticipants: required,
      sharedTerms: {
        provvypayAgreementId: 'agr-4',
        revision: 0,
        title: 'Four party',
        currency: 'AUD',
        summary: 'extensible',
      },
    });

    let open = runtime.getActiveProposal('agr-4')!;
    for (const party of ['p1', 'p2', 'p3']) {
      const result = runtime.accept({
        proposalContractId: open.contractId,
        actor: party,
      });
      expect(result.kind).toBe('StillOpen');
      if (result.kind === 'StillOpen') {
        open = runtime.getContract(
          result.proposalContractId
        ) as typeof open;
      }
    }

    expect(allRequiredAccepted(required, ['p1', 'p2', 'p3'])).toBe(false);

    const last = runtime.accept({
      proposalContractId: open.contractId,
      actor: 'p4',
    });
    expect(last.kind).toBe('Bound');
    expect(runtime.project('agr-4')?.stage).toBe('Bound');
  });

  it('projects Canton events into Commercial Network read models', async () => {
    const provider = createCantonCommercialNetworkProvider({
      defaultPlatformParty: HACKCANTON_DEMO.platform.party,
      now: () => '2026-07-16T12:00:00.000Z',
    });
    const projections = createProjectionService();
    provider.subscribeToWorkflowEvents((e) => projections.project(e));

    await provider.createSharedCommercialAgreement({
      agreementId: HACKCANTON_DEMO.agreementId,
      organizationId: HACKCANTON_DEMO.organizationId,
      name: HACKCANTON_DEMO.aiExtraction.title,
      payload: {
        requiredParticipants: HACKCANTON_DEMO.aiExtraction.counterparties.map(
          (c) => ({ party: c.party, role: c.role })
        ),
        currency: 'AUD',
        summary: HACKCANTON_DEMO.aiExtraction.summary,
      },
    });

    for (const c of HACKCANTON_DEMO.aiExtraction.counterparties) {
      await provider.submitParticipantApproval({
        agreementId: HACKCANTON_DEMO.agreementId,
        participantId: c.party,
      });
    }

    await provider.submitSettlementApproval({
      agreementId: HACKCANTON_DEMO.agreementId,
      approvedBy: HACKCANTON_DEMO.platform.party,
    });

    expect(projections.getAgreement(HACKCANTON_DEMO.agreementId)?.name).toBe(
      HACKCANTON_DEMO.aiExtraction.title
    );
    expect(
      projections.getParticipant('party::venue')?.approvalStatus
    ).toBe('Approved');
    const readyCid = provider
      .getRuntime()
      .getSettlementReady(HACKCANTON_DEMO.agreementId)?.contractId;
    expect(readyCid).toBeTruthy();
    expect(
      projections.getSettlement(
        `${HACKCANTON_DEMO.agreementId}:${readyCid}:agreement`
      )?.status
    ).toBe('ready');
  });

  it('resolves Canton via Commercial Network Layer without UI binding to Daml', async () => {
    setCommercialNetworkConfig(HACKCANTON_DEMO.organizationId, {
      provider: 'canton',
    });

    const registry = createCommercialNetworkProviderRegistry({
      canton: () =>
        createCantonCommercialNetworkProvider({
          defaultPlatformParty: HACKCANTON_DEMO.platform.party,
        }),
    });

    const network = openCommercialNetwork(
      {
        organizationId: HACKCANTON_DEMO.organizationId,
        projectId: HACKCANTON_DEMO.agreementId,
      },
      { registry }
    );

    expect(network.provider.providerId).toBe('canton');

    const created = await network.createSharedCommercialAgreement({
      agreementId: HACKCANTON_DEMO.agreementId,
      organizationId: null,
      name: 'Via CNL',
      payload: {
        requiredParticipants: [
          { party: 'party::venue', role: 'Venue' },
          { party: 'party::promoter', role: 'Promoter' },
          { party: 'party::artist', role: 'Artist' },
        ],
        summary: 'CNL path',
        currency: 'AUD',
      },
    });
    expect(created.ok).toBe(true);
    expect(network.projections.getAgreement(HACKCANTON_DEMO.agreementId)?.name).toBe(
      'Via CNL'
    );
  });

  it('rejects unauthorized accept and supports reject → re-propose revision', () => {
    const runtime = createCantonLedgerRuntime();
    const proposal = runtime.createProposal({
      platform: 'platform',
      requiredParticipants: [
        { party: 'venue', role: 'Venue' },
        { party: 'promoter', role: 'Promoter' },
      ],
      sharedTerms: {
        provvypayAgreementId: 'rev-1',
        revision: 0,
        title: 'Revise me',
        currency: 'AUD',
        summary: 's',
      },
    });

    expect(() =>
      runtime.accept({
        proposalContractId: proposal.contractId,
        actor: 'stranger',
      })
    ).toThrow(/required participant/);

    runtime.reject({ proposalContractId: proposal.contractId, actor: 'venue' });
    expect(runtime.getActiveProposal('rev-1')).toBeNull();

    runtime.createProposal({
      platform: 'platform',
      requiredParticipants: [
        { party: 'venue', role: 'Venue' },
        { party: 'promoter', role: 'Promoter' },
      ],
      sharedTerms: {
        provvypayAgreementId: 'rev-1',
        revision: 1,
        title: 'Revise me',
        currency: 'AUD',
        summary: 'revised',
      },
    });
    expect(runtime.project('rev-1')?.revision).toBe(1);
    expect(runtime.project('rev-1')?.stage).toBe('Proposed');
  });
});
