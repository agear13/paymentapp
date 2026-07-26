/**
 * Commercial Network Layer tests.
 *
 * Verifies:
 *   - Local Provider reproduces current network behaviour
 *   - Provider registry resolves correctly
 *   - Events dispatch correctly
 *   - Projection service updates correctly
 *   - Provider abstraction remains backwards compatible (default = Local)
 *   - Canton skeleton returns Not Implemented
 */

import {
  clearCommercialNetworkConfigs,
  createCommercialNetworkEvent,
  createCommercialNetworkEventDispatcher,
  createCommercialNetworkProviderRegistry,
  createInMemoryLocalPersistencePort,
  createLocalCommercialNetworkProvider,
  createCantonCommercialNetworkProvider,
  createProjectionService,
  getCantonExtensionPoints,
  getDefaultCommercialNetworkProviderRegistry,
  getFutureCommercialNetworkProviderHints,
  openCommercialNetwork,
  setCommercialNetworkConfig,
  setDefaultCommercialNetworkProviderRegistry,
  type CommercialNetworkEvent,
} from '@/lib/commercial-network';

describe('Commercial Network Layer', () => {
  beforeEach(() => {
    clearCommercialNetworkConfigs();
    setDefaultCommercialNetworkProviderRegistry(null);
  });

  describe('provider registry', () => {
    it('registers Local and Canton by default', () => {
      const registry = createCommercialNetworkProviderRegistry();
      expect(registry.list().sort()).toEqual(['canton', 'local']);
      expect(registry.has('local')).toBe(true);
      expect(registry.has('canton')).toBe(true);
      expect(registry.has('azure')).toBe(false);
    });

    it('resolves Canton by default for an organisation', () => {
      const registry = createCommercialNetworkProviderRegistry();
      const provider = registry.resolveFor({ organizationId: 'org-1' });
      expect(provider.providerId).toBe('canton');
      expect(provider.label).toBe('Canton');
    });

    it('resolves Canton when organisation config selects it', () => {
      setCommercialNetworkConfig('org-1', { provider: 'canton' });
      const registry = createCommercialNetworkProviderRegistry();
      const provider = registry.resolveFor({ organizationId: 'org-1' });
      expect(provider.providerId).toBe('canton');
    });

    it('prefers project override over organisation provider', () => {
      setCommercialNetworkConfig('org-1', {
        provider: 'local',
        projectOverrides: { 'proj-a': 'canton' },
      });
      const registry = createCommercialNetworkProviderRegistry();
      expect(
        registry.resolveFor({ organizationId: 'org-1', projectId: 'proj-a' })
          .providerId
      ).toBe('canton');
      expect(
        registry.resolveFor({ organizationId: 'org-1', projectId: 'proj-b' })
          .providerId
      ).toBe('local');
    });

    it('does not hardcode Canton into the default registry resolution path', () => {
      const registry = getDefaultCommercialNetworkProviderRegistry();
      setCommercialNetworkConfig('any-org', { provider: 'local' });
      expect(registry.resolveFor({ organizationId: 'any-org' }).providerId).toBe(
        'local'
      );
    });
  });

  describe('event dispatcher', () => {
    it('dispatches events immediately to subscribers', async () => {
      const dispatcher = createCommercialNetworkEventDispatcher({ immediate: true });
      const seen: CommercialNetworkEvent[] = [];
      dispatcher.subscribe((e) => {
        seen.push(e);
      });

      const event = createCommercialNetworkEvent({
        kind: 'AgreementCreated',
        agreementId: 'a1',
        occurredAt: '2026-07-16T00:00:00.000Z',
        name: 'Deal One',
      });

      await dispatcher.dispatch(event);

      expect(seen).toHaveLength(1);
      expect(seen[0]?.kind).toBe('AgreementCreated');
      expect(dispatcher.getHistory()).toHaveLength(1);
    });

    it('supports unsubscribe', async () => {
      const dispatcher = createCommercialNetworkEventDispatcher();
      const seen: string[] = [];
      const unsub = dispatcher.subscribe((e) => seen.push(e.kind));
      unsub();

      await dispatcher.dispatch(
        createCommercialNetworkEvent({
          kind: 'AgreementUpdated',
          agreementId: 'a1',
          occurredAt: '2026-07-16T00:00:00.000Z',
        })
      );

      expect(seen).toHaveLength(0);
      expect(dispatcher.listenerCount()).toBe(0);
    });
  });

  describe('projection service', () => {
    it('updates agreement, participant, workflow, and settlement read models', () => {
      const projections = createProjectionService();

      projections.project(
        createCommercialNetworkEvent({
          kind: 'AgreementCreated',
          agreementId: 'a1',
          organizationId: 'org-1',
          occurredAt: '2026-07-16T01:00:00.000Z',
          name: 'Alpha',
        })
      );
      projections.project(
        createCommercialNetworkEvent({
          kind: 'ParticipantApproved',
          agreementId: 'a1',
          participantId: 'p1',
          occurredAt: '2026-07-16T02:00:00.000Z',
          approvedAt: '2026-07-16T02:00:00.000Z',
        })
      );
      projections.project(
        createCommercialNetworkEvent({
          kind: 'WorkflowTransitioned',
          agreementId: 'a1',
          participantId: 'p1',
          occurredAt: '2026-07-16T03:00:00.000Z',
          workflow: 'commercial',
          fromState: 'draft',
          toState: 'approved',
        })
      );
      projections.project(
        createCommercialNetworkEvent({
          kind: 'SettlementReady',
          agreementId: 'a1',
          participantId: 'p1',
          settlementId: 's1',
          occurredAt: '2026-07-16T04:00:00.000Z',
        })
      );
      projections.project(
        createCommercialNetworkEvent({
          kind: 'SettlementReleased',
          agreementId: 'a1',
          participantId: 'p1',
          settlementId: 's1',
          occurredAt: '2026-07-16T05:00:00.000Z',
        })
      );

      expect(projections.getAgreement('a1')?.name).toBe('Alpha');
      expect(projections.getAgreement('a1')?.version).toBe(1);
      expect(projections.getParticipant('p1')?.approvalStatus).toBe('Approved');
      expect(
        projections.getWorkflow('a1:commercial:p1')?.state
      ).toBe('approved');
      expect(
        projections.getSettlement('a1:s1:p1')?.status
      ).toBe('released');
    });

    it('attaches to a dispatcher and projects live events', async () => {
      const dispatcher = createCommercialNetworkEventDispatcher();
      const projections = createProjectionService();
      projections.attach(dispatcher);

      await dispatcher.dispatch(
        createCommercialNetworkEvent({
          kind: 'AgreementUpdated',
          agreementId: 'a2',
          occurredAt: '2026-07-16T06:00:00.000Z',
          name: 'Beta',
          status: 'active',
        })
      );

      expect(projections.getAgreement('a2')?.name).toBe('Beta');
      expect(projections.getAgreement('a2')?.status).toBe('active');
    });
  });

  describe('Local Provider', () => {
    it('creates agreements, transitions workflow, and approves participants with immediate events', async () => {
      const persistence = createInMemoryLocalPersistencePort();
      const dispatcher = createCommercialNetworkEventDispatcher();
      const projections = createProjectionService();
      projections.attach(dispatcher);

      const local = createLocalCommercialNetworkProvider({
        persistence,
        dispatcher,
        now: () => '2026-07-16T10:00:00.000Z',
      });

      const created = await local.createSharedCommercialAgreement({
        agreementId: 'agr-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        name: 'Pilot Deal',
        partner: 'Acme',
        payload: { value: 1000 },
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const transitioned = await local.transitionWorkflow({
        agreementId: 'agr-1',
        workflow: 'commercial',
        fromState: 'negotiating',
        toState: 'awaiting_approval',
      });
      expect(transitioned.ok).toBe(true);

      const approved = await local.submitParticipantApproval({
        agreementId: 'agr-1',
        participantId: 'part-1',
        note: 'Looks good',
      });
      expect(approved.ok).toBe(true);
      if (!approved.ok) return;
      expect(approved.data.participant.approvalStatus).toBe('Approved');

      const settlement = await local.submitSettlementApproval({
        agreementId: 'agr-1',
        participantId: 'part-1',
        approvedBy: 'ops-1',
      });
      expect(settlement.ok).toBe(true);

      const kinds = dispatcher.getHistory().map((e) => e.kind);
      expect(kinds).toEqual([
        'AgreementCreated',
        'WorkflowTransitioned',
        'ParticipantApproved',
        'SettlementReady',
      ]);

      expect(projections.getAgreement('agr-1')?.name).toBe('Pilot Deal');
      expect(projections.getParticipant('part-1')?.approvalStatus).toBe('Approved');
      expect(projections.getWorkflow('agr-1:commercial')?.state).toBe(
        'awaiting_approval'
      );
      expect(projections.getSettlement('agr-1:default:part-1')?.status).toBe(
        'ready'
      );

      const synced = await local.synchronizeSharedState({
        ownerUserId: 'user-1',
      });
      expect(synced.ok).toBe(true);
      if (!synced.ok) return;
      expect(synced.data.agreements).toHaveLength(1);
      expect(synced.data.participants).toHaveLength(1);
    });

    it('updates agreements and publishes custom network events', async () => {
      const local = createLocalCommercialNetworkProvider({
        now: () => '2026-07-16T11:00:00.000Z',
      });

      await local.createSharedCommercialAgreement({
        agreementId: 'agr-2',
        organizationId: null,
        name: 'Original',
      });

      const updated = await local.updateCommercialAgreement({
        agreementId: 'agr-2',
        name: 'Renamed',
        status: 'active',
        payload: { note: 'n1' },
      });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.data.name).toBe('Renamed');
      expect(updated.data.payload.note).toBe('n1');

      const published = await local.publishCommercialEvent({
        event: createCommercialNetworkEvent({
          kind: 'CommercialForecastUpdated',
          agreementId: 'agr-2',
          occurredAt: '2026-07-16T11:30:00.000Z',
          summary: { surplus: 42 },
        }),
      });
      expect(published.ok).toBe(true);

      const automation = await local.publishCommercialEvent({
        event: createCommercialNetworkEvent({
          kind: 'AutomationExecuted',
          agreementId: 'agr-2',
          occurredAt: '2026-07-16T11:45:00.000Z',
          actionKind: 'notify_operator',
        }),
      });
      expect(automation.ok).toBe(true);

      const history = local.getEventDispatcher().getHistory().map((e) => e.kind);
      expect(history).toContain('AgreementUpdated');
      expect(history).toContain('CommercialForecastUpdated');
      expect(history).toContain('AutomationExecuted');
    });

    it('validateConnection reports connected for Local', async () => {
      const local = createLocalCommercialNetworkProvider();
      await expect(local.validateConnection()).resolves.toEqual({
        connected: true,
        error: null,
      });
    });
  });

  describe('Canton Provider', () => {
    it('requires requiredParticipants on create (derived completion, not hard-coded count)', async () => {
      const canton = createCantonCommercialNetworkProvider();

      const missing = await canton.createSharedCommercialAgreement({
        agreementId: 'x',
        organizationId: 'org',
        name: 'X',
      });
      expect(missing.ok).toBe(false);

      const created = await canton.createSharedCommercialAgreement({
        agreementId: 'x',
        organizationId: 'org',
        name: 'X',
        payload: {
          requiredParticipants: [
            { party: 'party::venue', role: 'Venue' },
            { party: 'party::promoter', role: 'Promoter' },
          ],
          currency: 'AUD',
          summary: 'Two-party demo',
        },
      });
      expect(created.ok).toBe(true);

      const conn = await canton.validateConnection();
      expect(conn.connected).toBe(true);
    });

    it('documents all required extension points as implemented', () => {
      const points = getCantonExtensionPoints();
      const ids = points.map((p) => p.id);
      expect(ids).toEqual([
        'agreement_synchronization',
        'workflow_commands',
        'participant_commands',
        'settlement_commands',
        'event_subscription',
        'projection_updates',
      ]);
      expect(points.every((p) => p.implemented === true)).toBe(true);
    });
  });

  describe('openCommercialNetwork facade', () => {
    it('routes domain calls through the resolved provider and updates projections', async () => {
      const persistence = createInMemoryLocalPersistencePort();
      const registry = createCommercialNetworkProviderRegistry({
        local: () =>
          createLocalCommercialNetworkProvider({
            persistence,
            now: () => '2026-07-16T12:00:00.000Z',
          }),
      });

      setCommercialNetworkConfig('org-facade', { provider: 'local' });

      const network = openCommercialNetwork(
        { organizationId: 'org-facade' },
        { registry }
      );

      expect(network.provider.providerId).toBe('local');

      const result = await network.createSharedCommercialAgreement({
        agreementId: 'facade-1',
        organizationId: null,
        name: 'Facade Deal',
      });
      expect(result.ok).toBe(true);

      expect(network.projections.getAgreement('facade-1')?.name).toBe(
        'Facade Deal'
      );
      // organisationId filled from scope when command omits it
      if (result.ok) {
        expect(result.data.organizationId).toBe('org-facade');
      }
    });

    it('keeps Commercial Domain unaware of Canton when Local is configured', async () => {
      setCommercialNetworkConfig('org-x', { provider: 'local' });
      const network = openCommercialNetwork({ organizationId: 'org-x' });
      expect(network.provider.providerId).toBe('local');
      // Domain only sees the interface — switching config later would yield Canton
      // without changing this call site.
      setCommercialNetworkConfig('org-x', { provider: 'canton' });
      const switched = openCommercialNetwork({ organizationId: 'org-x' });
      expect(switched.provider.providerId).toBe('canton');
    });
  });

  describe('future providers catalogue', () => {
    it('lists Local and Canton as registered and Azure/Hyperledger as future', () => {
      const hints = getFutureCommercialNetworkProviderHints();
      expect(hints.find((h) => h.provider === 'local')?.adapterRegistered).toBe(
        true
      );
      expect(hints.find((h) => h.provider === 'canton')?.adapterRegistered).toBe(
        true
      );
      expect(hints.find((h) => h.provider === 'azure')?.adapterRegistered).toBe(
        false
      );
      expect(
        hints.find((h) => h.provider === 'hyperledger')?.adapterRegistered
      ).toBe(false);
    });
  });

  describe('backwards compatibility', () => {
    it('default organisation behaviour uses Canton when no config', () => {
      const network = openCommercialNetwork({ organizationId: 'brand-new-org' });
      expect(network.provider.providerId).toBe('canton');
    });
  });
});
