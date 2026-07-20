/**
 * LocalNet smoke test — runs only when CANTON_LEDGER_MODE=localnet
 * and CANTON_AUTH_TOKEN is set against a live Quickstart LocalNet.
 *
 *   CANTON_LEDGER_MODE=localnet \
 *   CANTON_AUTH_TOKEN=... \
 *   CANTON_PLATFORM_PARTY=... \
 *   CANTON_VENUE_PARTY=... \
 *   CANTON_PROMOTER_PARTY=... \
 *   CANTON_ARTIST_PARTY=... \
 *   npm test -- __tests__/commercial-network/localnet-smoke.test.ts
 */

import {
  createCantonCommercialNetworkProvider,
  createProjectionService,
} from '@/lib/commercial-network';

const enabled =
  process.env.CANTON_LEDGER_MODE === 'localnet' &&
  Boolean(process.env.CANTON_AUTH_TOKEN) &&
  Boolean(process.env.CANTON_PLATFORM_PARTY) &&
  Boolean(process.env.CANTON_VENUE_PARTY) &&
  Boolean(process.env.CANTON_PROMOTER_PARTY) &&
  Boolean(process.env.CANTON_ARTIST_PARTY);

const describeLive = enabled ? describe : describe.skip;

describeLive('LocalNet smoke (real Canton)', () => {
  it('propose → 3× accept → SettlementReady → projection', async () => {
    const platform = process.env.CANTON_PLATFORM_PARTY!;
    const venue = process.env.CANTON_VENUE_PARTY!;
    const promoter = process.env.CANTON_PROMOTER_PARTY!;
    const artist = process.env.CANTON_ARTIST_PARTY!;

    const provider = createCantonCommercialNetworkProvider({
      defaultPlatformParty: platform,
    });
    expect(provider.getLedgerMode()).toBe('localnet');

    const conn = await provider.validateConnection();
    expect(conn.connected).toBe(true);

    const projections = createProjectionService();
    provider.subscribeToWorkflowEvents((e) => projections.project(e));

    const agreementId = `smoke-${Date.now()}`;
    const created = await provider.createSharedCommercialAgreement({
      agreementId,
      organizationId: 'org-smoke',
      name: 'LocalNet Smoke Agreement',
      payload: {
        platformParty: platform,
        requiredParticipants: [
          { party: venue, role: 'Venue' },
          { party: promoter, role: 'Promoter' },
          { party: artist, role: 'Artist' },
        ],
        currency: 'AUD',
        summary: 'HackCanton LocalNet smoke path',
        revision: 0,
      },
    });
    expect(created.ok).toBe(true);

    for (const party of [venue, promoter, artist]) {
      const accepted = await provider.submitParticipantApproval({
        agreementId,
        participantId: party,
      });
      expect(accepted.ok).toBe(true);
    }

    const ready = await provider.submitSettlementApproval({
      agreementId,
      approvedBy: platform,
    });
    expect(ready.ok).toBe(true);

    expect(projections.getAgreement(agreementId)?.status).toBeTruthy();
    expect(projections.getParticipant(venue)?.approvalStatus).toBe('Approved');
  }, 120_000);
});
