import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assessmentSelectedXero,
  buildConnectedSystemsPresentation,
  remainingTrialDays,
  resolveConnectedSystemsAudience,
} from '@/lib/journey/workspace-connected-presentation';

const now = new Date('2026-08-22T12:00:00.000Z');
const trialEndsAt = '2026-09-21T12:00:00.000Z';

const activeTrial = {
  hasActiveFirstPartyTrial: true,
  trialExpired: false,
  trialEndsAt,
  xeroAllowed: true,
  plan: 'professional' as const,
  now,
};

describe('assessment vs live connection', () => {
  it('treats only an explicit Xero assessment answer as selected Xero', () => {
    expect(assessmentSelectedXero('Xero')).toBe(true);
    expect(assessmentSelectedXero('MYOB')).toBe(false);
    expect(assessmentSelectedXero('None / Spreadsheets')).toBe(false);
    expect(assessmentSelectedXero(null)).toBe(false);
    expect(assessmentSelectedXero(undefined)).toBe(false);
  });

  it('never treats a selected assessment as a live connection', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: false,
      ...activeTrial,
    });
    expect(view.selectedXero).toBe(true);
    expect(view.xeroConnected).toBe(false);
    expect(view.mode).toBe('setup');
    expect(view.title).toBe('Connect your systems');
  });
});

describe('trial clock', () => {
  it('derives remaining days from persisted trial_ends_at', () => {
    expect(remainingTrialDays(trialEndsAt, now)).toBe(30);
    expect(remainingTrialDays(new Date('2026-08-23T12:00:00.000Z'), now)).toBe(1);
    expect(remainingTrialDays(null, now)).toBeNull();
  });
});

describe('reproduction: active trial with zero live connections', () => {
  it('shows Connect Xero when assessment is missing and no systems are connected', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: undefined,
      xeroConnected: false,
      connectionKnown: true,
      ...activeTrial,
    });

    expect(view.mode).toBe('setup');
    expect(view.title).toBe('Connect your systems');
    expect(view.selectedXero).toBe(false);
    expect(view.description).not.toMatch(/told us/i);
    expect(view.xeroOffer?.kind).toBe('available_connect');
    expect(view.xeroOffer?.showConnect).toBe(true);
    expect(view.xeroOffer?.explanation).toMatch(/Professional Trial/i);
  });

  it('shows Connect Xero while live Xero status is still unknown', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: undefined,
      xeroConnected: false,
      connectionKnown: false,
      entitlementsLoading: false,
      ...activeTrial,
    });

    expect(view.mode).toBe('setup');
    expect(view.xeroConnected).toBe(false);
    expect(view.xeroOffer?.showConnect).toBe(true);
    expect(view.title).toBe('Connect your systems');
  });

  it('does not send the user back to Workspace as the only action', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: undefined,
      xeroConnected: false,
      ...activeTrial,
    });
    expect(view).not.toHaveProperty('next');
    expect(JSON.stringify(view)).not.toMatch(/Enter workspace|Commercial Operating System/);
  });

  it('uses assessment copy only when the user actually selected Xero', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: false,
      ...activeTrial,
    });
    expect(view.xeroOffer?.kind).toBe('recommended_connect');
    expect(view.xeroOffer?.showConnect).toBe(true);
    expect(view.description).toMatch(/told us during setup/i);
    expect(view.xeroOffer?.explanation).toMatch(/not connected yet/i);
  });
});

describe('required Connected Systems states', () => {
  it('Active Professional Trial + Xero connected becomes infrastructure', () => {
    const view = buildConnectedSystemsPresentation({
      accounting: 'Xero',
      xeroConnected: true,
      xeroConnectionState: 'READY',
      ...activeTrial,
    });

    expect(view.mode).toBe('infrastructure');
    expect(view.title).toBe('Your operating infrastructure.');
    expect(view.xeroOffer).toBeNull();
    expect(view.showReadinessBanner).toBe(true);
    expect(view.xeroConnected).toBe(true);
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

    expect(view.mode).toBe('expired');
    expect(view.xeroUsable).toBe(false);
    expect(view.xeroOffer?.kind).toBe('unavailable');
    expect(view.xeroOffer?.showConnect).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/Enter workspace/);
  });

  it('Expired trial with Xero already connected keeps the live connection', () => {
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
    expect(view.title).toMatch(/still here/i);
  });

  it('Existing legacy Starter organisation does not present Xero as included', () => {
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
    expect(view.mode).toBe('legacy_empty');
    expect(view.xeroOffer).toBeNull();
    expect(view.description).not.toMatch(/told us|Professional Trial/i);
    expect(JSON.stringify(view)).not.toMatch(/Enter workspace/);
  });

  it('does not classify an in-flight entitlement fetch as Starter', () => {
    expect(
      resolveConnectedSystemsAudience({
        entitlementsLoading: true,
        hasActiveFirstPartyTrial: false,
        trialExpired: false,
        xeroAllowed: false,
        plan: 'starter',
      })
    ).toBeNull();

    const view = buildConnectedSystemsPresentation({
      accounting: undefined,
      xeroConnected: false,
      entitlementsLoading: true,
      hasActiveFirstPartyTrial: false,
      trialExpired: false,
      trialEndsAt: null,
      xeroAllowed: false,
      plan: 'starter',
      now,
    });
    expect(view.mode).toBe('setup');
    expect(view.xeroOffer?.showConnect).toBe(true);
  });
});

describe('Connected Systems screen wiring', () => {
  it('uses live Xero status, entitlements, and persisted onboarding — not a Workspace loop', () => {
    const source = readFileSync(
      join(__dirname, '../../components/journey/lovable/workspace-connected-screen.tsx'),
      'utf8'
    );
    expect(source).toContain('buildConnectedSystemsPresentation');
    expect(source).toContain('useEntitlements');
    expect(source).toContain('/api/xero/status');
    expect(source).toContain('/api/onboarding');
    expect(source).toContain('xeroConnectUrl');
    expect(source).toContain('Connect Xero');
    expect(source).not.toContain('Enter workspace');
    expect(source).not.toContain('Coming soon');
    expect(source).not.toContain('readAssessmentWantsXero');
  });
});
