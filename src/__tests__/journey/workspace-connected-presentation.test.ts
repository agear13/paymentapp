import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  assessmentSelectedXero,
  buildConnectedSystemsPresentation,
  remainingTrialDays,
  resolveConnectedSystemsAudience,
} from '@/lib/journey/workspace-connected-presentation';

const now = new Date('2026-08-22T12:00:00.000Z');
const trialEndsAt = '2026-09-21T12:00:00.000Z';

describe('assessment vs live connection', () => {
  it('treats only an explicit Xero assessment answer as selected Xero', () => {
    expect(assessmentSelectedXero('Xero')).toBe(true);
    expect(assessmentSelectedXero('MYOB')).toBe(false);
    expect(assessmentSelectedXero('None / Spreadsheets')).toBe(false);
    expect(assessmentSelectedXero(null)).toBe(false);
    expect(assessmentSelectedXero(undefined)).toBe(false);
    expect(assessmentSelectedXero('')).toBe(false);
  });

  it('does not treat a selected assessment as a live connection', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: false,
      hasActiveFirstPartyTrial: true,
      trialExpired: false,
      trialEndsAt,
      xeroAllowed: true,
      plan: 'professional',
      now,
    });
    expect(view.selectedXero).toBe(true);
    expect(view.xeroConnected).toBe(false);
    expect(view.xeroOffer?.kind).toBe('recommended_connect');
    expect(view.description).toContain('told us during setup');
    expect(view.description).toContain('not connected');
  });
});

describe('trial clock', () => {
  it('derives remaining days from persisted trial_ends_at', () => {
    expect(remainingTrialDays(trialEndsAt, now)).toBe(30);
    expect(remainingTrialDays(new Date('2026-08-23T12:00:00.000Z'), now)).toBe(1);
    expect(remainingTrialDays(new Date('2026-08-21T12:00:00.000Z'), now)).toBe(0);
    expect(remainingTrialDays(null, now)).toBeNull();
  });
});

describe('Connected Systems audiences', () => {
  it('resolves trial, expired, paid, and legacy Starter without defaulting to Xero', () => {
    expect(
      resolveConnectedSystemsAudience({
        hasActiveFirstPartyTrial: true,
        trialExpired: false,
        xeroAllowed: true,
        plan: 'professional',
      })
    ).toBe('active_first_party_trial');
    expect(
      resolveConnectedSystemsAudience({
        hasActiveFirstPartyTrial: false,
        trialExpired: true,
        xeroAllowed: false,
        plan: 'professional',
      })
    ).toBe('expired_first_party_trial');
    expect(
      resolveConnectedSystemsAudience({
        hasActiveFirstPartyTrial: false,
        trialExpired: false,
        xeroAllowed: true,
        plan: 'professional',
      })
    ).toBe('entitled_paid');
    expect(
      resolveConnectedSystemsAudience({
        hasActiveFirstPartyTrial: false,
        trialExpired: false,
        xeroAllowed: false,
        plan: 'starter',
      })
    ).toBe('legacy_starter');
  });
});

describe('required Connected Systems states', () => {
  it('Active Professional Trial + selected Xero + not connected', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: false,
      hasActiveFirstPartyTrial: true,
      trialExpired: false,
      trialEndsAt,
      xeroAllowed: true,
      plan: 'professional',
      now,
    });

    expect(view.audience).toBe('active_first_party_trial');
    expect(view.xeroOffer?.kind).toBe('recommended_connect');
    expect(view.xeroOffer?.showConnect).toBe(true);
    expect(view.xeroOffer?.recommended).toBe(true);
    expect(view.xeroOffer?.explanation).toMatch(/Professional Trial includes Xero/i);
    expect(view.trialNote).toContain('30 days remaining');
    expect(view.next.primary.kind).toBe('connect_xero');
    expect(view.description).not.toMatch(/Coming soon|Stripe|Outlook|Slack/i);
  });

  it('Active Professional Trial + Xero connected', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: true,
      xeroConnectionState: 'READY',
      hasActiveFirstPartyTrial: true,
      trialExpired: false,
      trialEndsAt,
      xeroAllowed: true,
      plan: 'professional',
      now,
    });

    expect(view.xeroConnected).toBe(true);
    expect(view.xeroOffer).toBeNull();
    expect(view.showReadinessBanner).toBe(true);
    expect(view.next.primary.kind).toBe('manage_xero');
    expect(view.next.primary.href).toBe(COMMERCIAL_OS_ROUTES.connectedXero);
    expect(view.next.message).toMatch(/ready to sync/i);
    expect(view.trialNote).toContain('available during your trial');
  });

  it('Active Professional Trial + no Xero selected', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'None / Spreadsheets',
      xeroConnected: false,
      hasActiveFirstPartyTrial: true,
      trialExpired: false,
      trialEndsAt,
      xeroAllowed: true,
      plan: 'professional',
      now,
    });

    expect(view.selectedXero).toBe(false);
    expect(view.description).not.toMatch(/told us/i);
    expect(view.description).toMatch(/has not assumed/i);
    expect(view.xeroOffer?.kind).toBe('available_connect');
    expect(view.xeroOffer?.showConnect).toBe(true);
    expect(view.xeroOffer?.recommended).toBe(false);
    expect(view.next.primary.kind).toBe('enter_workspace');
  });

  it('Expired first-party trial does not present Xero as usable', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: false,
      hasActiveFirstPartyTrial: false,
      trialExpired: true,
      trialEndsAt: '2026-08-21T12:00:00.000Z',
      xeroAllowed: false,
      plan: 'professional',
      now,
    });

    expect(view.audience).toBe('expired_first_party_trial');
    expect(view.xeroUsable).toBe(false);
    expect(view.xeroOffer?.kind).toBe('unavailable');
    expect(view.xeroOffer?.showConnect).toBe(false);
    expect(view.trialNote).toBeNull();
    expect(view.description).toMatch(/trial has ended/i);
    expect(view.next.primary.kind).toBe('enter_workspace');
    expect(view.next.message).not.toMatch(/Connect Xero|\$49|Upgrade|Checkout/i);
  });

  it('Expired trial with Xero already connected keeps the live connection and hides connect', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: true,
      xeroConnectionState: 'READY',
      hasActiveFirstPartyTrial: false,
      trialExpired: true,
      trialEndsAt: '2026-08-21T12:00:00.000Z',
      xeroAllowed: false,
      plan: 'professional',
      now,
    });

    expect(view.xeroConnected).toBe(true);
    expect(view.xeroOffer).toBeNull();
    expect(view.showReadinessBanner).toBe(false);
    expect(view.next.primary.kind).toBe('enter_workspace');
  });

  it('Existing legacy Starter organisation does not present Xero as a usable Professional integration', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: undefined,
      xeroConnected: false,
      hasActiveFirstPartyTrial: false,
      trialExpired: false,
      trialEndsAt: null,
      xeroAllowed: false,
      plan: 'starter',
      now,
    });

    expect(view.audience).toBe('legacy_starter');
    expect(view.selectedXero).toBe(false);
    expect(view.xeroOffer).toBeNull();
    expect(view.trialNote).toBeNull();
    expect(view.description).not.toMatch(/told us|Professional Trial/i);
    expect(view.next.primary.kind).toBe('enter_workspace');
  });

  it('does not treat an unknown live connection as connected or as a Connect CTA', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: false,
      connectionKnown: false,
      hasActiveFirstPartyTrial: true,
      trialExpired: false,
      trialEndsAt,
      xeroAllowed: true,
      plan: 'professional',
      now,
    });
    expect(view.xeroConnected).toBe(false);
    expect(view.xeroOffer).toBeNull();
    expect(view.next.primary.kind).toBe('enter_workspace');
  });
});

describe('Connected Systems screen wiring', () => {
  it('uses live Xero status, entitlements, and persisted onboarding — not invented integrations', () => {
    const source = readFileSync(
      join(__dirname, '../../components/journey/lovable/workspace-connected-screen.tsx'),
      'utf8'
    );
    expect(source).toContain('buildConnectedSystemsPresentation');
    expect(source).toContain('useEntitlements');
    expect(source).toContain('/api/xero/status');
    expect(source).toContain('/api/onboarding');
    expect(source).toContain('xeroConnectUrl');
    expect(source).not.toContain('Coming soon');
    expect(source).not.toContain('readAssessmentWantsXero');
    expect(source).not.toMatch(/wantsXero\s*=\s*true/);
  });
});
