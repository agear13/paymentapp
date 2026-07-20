/**
 * LocalNet JSON API adapter — unit tests with mocked fetch.
 * Verifies Create / Accept / SettlementReady command shapes and event emission.
 */

import { createLocalNetJsonApiAdapter } from '@/lib/commercial-network/providers/canton/localnet-json-api-adapter';
import { createCantonCommercialNetworkProvider } from '@/lib/commercial-network/providers/canton/canton-provider';
import { createProjectionService } from '@/lib/commercial-network/projection-service';
import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';

function treeWithCreates(
  templates: Array<{ template: string; contractId: string }>
) {
  return {
    transactionTree: {
      eventsById: Object.fromEntries(
        templates.map((t, i) => [
          String(i),
          {
            CreatedEvent: {
              contractId: t.contractId,
              templateId: `#provvypay-shared-commercial-agreement:SharedCommercialAgreement.Workflow:${t.template}`,
            },
          },
        ])
      ),
    },
  };
}

describe('LocalNetJsonApiAdapter', () => {
  it('submits Create / Accept / DeclareSettlementReady and emits projection events', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    let step = 0;

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v2/version')) {
        return new Response(JSON.stringify({ version: '3.5.2' }), { status: 200 });
      }
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      step += 1;
      if (step === 1) {
        return new Response(
          JSON.stringify(
            treeWithCreates([{ template: 'CommercialAgreementProposal', contractId: 'cid-prop-1' }])
          ),
          { status: 200 }
        );
      }
      if (step === 2) {
        return new Response(
          JSON.stringify(
            treeWithCreates([
              { template: 'CommercialAgreementProposal', contractId: 'cid-prop-2' },
            ])
          ),
          { status: 200 }
        );
      }
      if (step === 3) {
        return new Response(
          JSON.stringify(
            treeWithCreates([
              { template: 'CommercialAgreementProposal', contractId: 'cid-prop-3' },
            ])
          ),
          { status: 200 }
        );
      }
      if (step === 4) {
        return new Response(
          JSON.stringify(
            treeWithCreates([{ template: 'CommercialAgreement', contractId: 'cid-agr-1' }])
          ),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify(
          treeWithCreates([{ template: 'SettlementReady', contractId: 'cid-ready-1' }])
        ),
        { status: 200 }
      );
    };

    const adapter = createLocalNetJsonApiAdapter({
      jsonApiBaseUrl: 'http://localhost:3975',
      authToken: 'test-token',
      packageName: 'provvypay-shared-commercial-agreement',
      moduleName: 'SharedCommercialAgreement.Workflow',
      applicationId: 'provvypay-sca',
      fetchImpl,
    });

    const events: CommercialNetworkEvent[] = [];
    adapter.subscribe((e) => {
      events.push(e);
    });

    const conn = await adapter.validateConnection();
    expect(conn.connected).toBe(true);

    await adapter.createProposal({
      platform: 'party::platform',
      requiredParticipants: [
        { party: 'party::venue', role: 'Venue' },
        { party: 'party::promoter', role: 'Promoter' },
        { party: 'party::artist', role: 'Artist' },
      ],
      sharedTerms: {
        provvypayAgreementId: 'agr-localnet',
        revision: 0,
        title: 'LocalNet Demo',
        currency: 'AUD',
        summary: 'smoke',
      },
    });

    expect(calls[0]?.body).toMatchObject({
      commands: [
        {
          CreateCommand: {
            templateId:
              '#provvypay-shared-commercial-agreement:SharedCommercialAgreement.Workflow:CommercialAgreementProposal',
          },
        },
      ],
      actAs: ['party::platform'],
    });

    await adapter.accept({
      proposalContractId: 'cid-prop-1',
      actor: 'party::venue',
    });
    await adapter.accept({
      proposalContractId: 'cid-prop-2',
      actor: 'party::promoter',
    });
    const bound = await adapter.accept({
      proposalContractId: 'cid-prop-3',
      actor: 'party::artist',
    });
    expect(bound).toEqual({ kind: 'Bound', agreementContractId: 'cid-agr-1' });

    const ready = await adapter.declareSettlementReady({
      agreementContractId: 'cid-agr-1',
      platform: 'party::platform',
    });
    expect(ready.settlementReadyContractId).toBe('cid-ready-1');

    const projection = await adapter.project('agr-localnet');
    expect(projection?.stage).toBe('SettlementReady');
    expect(events.map((e) => e.kind)).toEqual(
      expect.arrayContaining([
        'AgreementCreated',
        'ParticipantApproved',
        'SettlementReady',
      ])
    );
  });

  it('Canton provider in localnet mode uses adapter and updates Projection Service', async () => {
    let step = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/v2/version')) {
        return new Response('{}', { status: 200 });
      }
      step += 1;
      if (step === 1) {
        return new Response(
          JSON.stringify(
            treeWithCreates([{ template: 'CommercialAgreementProposal', contractId: 'p1' }])
          ),
          { status: 200 }
        );
      }
      if (step < 4) {
        return new Response(
          JSON.stringify(
            treeWithCreates([
              {
                template: 'CommercialAgreementProposal',
                contractId: `p${step}`,
              },
            ])
          ),
          { status: 200 }
        );
      }
      if (step === 4) {
        return new Response(
          JSON.stringify(
            treeWithCreates([{ template: 'CommercialAgreement', contractId: 'a1' }])
          ),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify(
          treeWithCreates([{ template: 'SettlementReady', contractId: 'r1' }])
        ),
        { status: 200 }
      );
    };

    const adapter = createLocalNetJsonApiAdapter({
      jsonApiBaseUrl: 'http://localhost:3975',
      authToken: 't',
      packageName: 'provvypay-shared-commercial-agreement',
      moduleName: 'SharedCommercialAgreement.Workflow',
      applicationId: 'provvypay-sca',
      fetchImpl,
    });

    const provider = createCantonCommercialNetworkProvider({
      adapter,
      defaultPlatformParty: 'party::platform',
    });
    expect(provider.getLedgerMode()).toBe('localnet');

    const projections = createProjectionService();
    provider.subscribeToWorkflowEvents((e) => projections.project(e));

    const created = await provider.createSharedCommercialAgreement({
      agreementId: 'agr-1',
      organizationId: 'org',
      name: 'Via LocalNet adapter',
      payload: {
        requiredParticipants: [
          { party: 'party::venue', role: 'Venue' },
          { party: 'party::promoter', role: 'Promoter' },
          { party: 'party::artist', role: 'Artist' },
        ],
        summary: 's',
        currency: 'AUD',
      },
    });
    expect(created.ok).toBe(true);

    for (const party of ['party::venue', 'party::promoter', 'party::artist']) {
      const accepted = await provider.submitParticipantApproval({
        agreementId: 'agr-1',
        participantId: party,
      });
      expect(accepted.ok).toBe(true);
    }

    const ready = await provider.submitSettlementApproval({
      agreementId: 'agr-1',
      approvedBy: 'party::platform',
    });
    expect(ready.ok).toBe(true);

    expect(projections.getAgreement('agr-1')?.name).toBe('Via LocalNet adapter');
    expect(projections.getParticipant('party::venue')?.approvalStatus).toBe(
      'Approved'
    );
  });
});
