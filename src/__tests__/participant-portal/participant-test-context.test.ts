import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  evaluateParticipantAccess,
  isAuthorisedParticipantWorkspaceIdentity,
} from '@/lib/participant-portal/participant-access';
import {
  createParticipantTestContextPayload,
  isEligibleParticipantTestSubject,
  isParticipantTestContextEnabled,
  resolveVerifiedParticipantTestContext,
  signParticipantTestContext,
  verifyParticipantTestContext,
} from '@/lib/participant-portal/participant-test-context';

const SECRET = 'test-participant-context-secret-minimum-32';
const OWNER = 'owner-user';
const ACTOR = OWNER;
const OTHER = 'other-user';
const BOUND = 'bound-user';
const PARTICIPANT_ID = 'p-qa-1';
const PORTAL_TOKEN = 'portal-token-1';

function mintCookie(overrides?: Partial<ReturnType<typeof createParticipantTestContextPayload>>) {
  const payload = {
    ...createParticipantTestContextPayload({
      actorUserId: ACTOR,
      participantId: PARTICIPANT_ID,
      portalToken: PORTAL_TOKEN,
      nowMs: 1_700_000_000_000,
    }),
    ...overrides,
  };
  return signParticipantTestContext(payload, SECRET);
}

describe('participant test context gate', () => {
  it('is hard-disabled in actual production even when the flag is on', () => {
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'production',
        ENABLE_PARTICIPANT_TEST_CONTEXT: 'true',
      })
    ).toBe(false);
  });

  it('may be enabled on the existing staging marker only with explicit opt-in', () => {
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'production',
        ENABLE_PARTICIPANT_TEST_CONTEXT: 'true',
        ALLOW_STRIPE_TEST_KEYS: 'true',
      })
    ).toBe(true);
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'production',
        ENABLE_PARTICIPANT_TEST_CONTEXT: 'false',
        ALLOW_STRIPE_TEST_KEYS: 'true',
      })
    ).toBe(false);
  });

  it('is disabled when the explicit flag is off', () => {
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'development',
        ENABLE_PARTICIPANT_TEST_CONTEXT: 'false',
      })
    ).toBe(false);
  });

  it('can be enabled in development and test with explicit opt-in', () => {
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'development',
        ENABLE_PARTICIPANT_TEST_CONTEXT: 'true',
      })
    ).toBe(true);
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'test',
        ENABLE_PARTICIPANT_TEST_CONTEXT: '1',
      })
    ).toBe(true);
  });

  it('does not enable merely because NEXT_PUBLIC_DEV_TOOLS would be on', () => {
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'production',
        ENABLE_PARTICIPANT_TEST_CONTEXT: 'true',
        ALLOW_STRIPE_TEST_KEYS: undefined,
      })
    ).toBe(false);
    expect(
      isParticipantTestContextEnabled({
        NODE_ENV: 'development',
        ENABLE_PARTICIPANT_TEST_CONTEXT: undefined,
      })
    ).toBe(false);
  });
});

describe('participant test context cookie', () => {
  const nowMs = 1_700_000_000_000;

  it('accepts a valid context for the current actor', () => {
    const cookie = mintCookie();
    const verified = verifyParticipantTestContext(cookie, SECRET, nowMs);
    expect(verified?.actorUserId).toBe(ACTOR);
    expect(verified?.participantId).toBe(PARTICIPANT_ID);
  });

  it('rejects a forged signature', () => {
    const cookie = mintCookie();
    const [encoded] = cookie.split('.');
    expect(verifyParticipantTestContext(`${encoded}.forgedsignature`, SECRET, nowMs)).toBeNull();
  });

  it('rejects an expired context', () => {
    const cookie = mintCookie({ exp: Math.floor(nowMs / 1000) - 10 });
    expect(verifyParticipantTestContext(cookie, SECRET, nowMs)).toBeNull();
  });

  it('rejects a malformed context', () => {
    expect(verifyParticipantTestContext('not-a-cookie', SECRET, nowMs)).toBeNull();
    expect(verifyParticipantTestContext('', SECRET, nowMs)).toBeNull();
    expect(verifyParticipantTestContext(null, SECRET, nowMs)).toBeNull();
  });

  it('rejects a context minted for another actor', () => {
    const cookie = mintCookie({ actorUserId: OTHER });
    expect(
      resolveVerifiedParticipantTestContext({
        enabled: true,
        cookieValue: cookie,
        secret: SECRET,
        actorUserId: ACTOR,
        participantId: PARTICIPANT_ID,
        portalToken: PORTAL_TOKEN,
        dealOwnerUserId: OWNER,
        authenticatedUserId: null,
        nowMs,
      })
    ).toBeNull();
  });

  it('rejects the wrong participant row', () => {
    const cookie = mintCookie();
    expect(
      resolveVerifiedParticipantTestContext({
        enabled: true,
        cookieValue: cookie,
        secret: SECRET,
        actorUserId: ACTOR,
        participantId: 'p-someone-else',
        portalToken: PORTAL_TOKEN,
        dealOwnerUserId: OWNER,
        authenticatedUserId: null,
        nowMs,
      })
    ).toBeNull();
  });

  it('rejects when the feature is disabled even if the cookie is valid', () => {
    const cookie = mintCookie();
    expect(
      resolveVerifiedParticipantTestContext({
        enabled: false,
        cookieValue: cookie,
        secret: SECRET,
        actorUserId: ACTOR,
        participantId: PARTICIPANT_ID,
        portalToken: PORTAL_TOKEN,
        dealOwnerUserId: OWNER,
        authenticatedUserId: null,
        nowMs,
      })
    ).toBeNull();
  });
});

describe('participant test eligibility', () => {
  it('allows an unbound row on a deal the actor owns', () => {
    expect(
      isEligibleParticipantTestSubject({
        actorUserId: ACTOR,
        dealOwnerUserId: OWNER,
        authenticatedUserId: null,
      })
    ).toEqual({ eligible: true });
  });

  it('allows a row already bound to the actor', () => {
    expect(
      isEligibleParticipantTestSubject({
        actorUserId: ACTOR,
        dealOwnerUserId: OWNER,
        authenticatedUserId: ACTOR,
      })
    ).toEqual({ eligible: true });
  });

  it('never allows a row bound to another user', () => {
    expect(
      isEligibleParticipantTestSubject({
        actorUserId: ACTOR,
        dealOwnerUserId: OWNER,
        authenticatedUserId: BOUND,
      })
    ).toEqual({ eligible: false, reason: 'bound_to_other_user' });
  });

  it('requires the actor to own the deal', () => {
    expect(
      isEligibleParticipantTestSubject({
        actorUserId: OTHER,
        dealOwnerUserId: OWNER,
        authenticatedUserId: null,
      })
    ).toEqual({ eligible: false, reason: 'not_deal_owner' });
  });
});

describe('test context access matrix', () => {
  const testContext = createParticipantTestContextPayload({
    actorUserId: ACTOR,
    participantId: PARTICIPANT_ID,
    portalToken: PORTAL_TOKEN,
  });

  it('grants participant mutate to an eligible unbound row', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: ACTOR, email: 'owner@example.com' },
        participantEmail: 'qa@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
        participantId: PARTICIPANT_ID,
        portalToken: PORTAL_TOKEN,
        testContext,
      })
    ).toEqual({ status: 'ok', role: 'participant', accessGrant: 'test_context' });
  });

  it('does not impersonate a participant bound to another user', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: ACTOR, email: 'owner@example.com' },
        participantEmail: 'customer@example.com',
        authenticatedUserId: BOUND,
        dealOwnerUserId: OWNER,
        action: 'mutate',
        participantId: PARTICIPANT_ID,
        portalToken: PORTAL_TOKEN,
        testContext,
      })
    ).toEqual({ status: 'denied', role: null, accessGrant: null });
  });

  it('keeps genuine participant access unchanged', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: BOUND, email: 'qa@example.com' },
        participantEmail: 'qa@example.com',
        authenticatedUserId: BOUND,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'ok', role: 'participant', accessGrant: 'genuine' });
  });

  it('keeps operator preview unchanged without a matching test context', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: OWNER, email: 'owner@example.com' },
        participantEmail: 'qa@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'read',
      })
    ).toEqual({ status: 'ok', role: 'operator_preview', accessGrant: 'operator_preview' });
    expect(
      isAuthorisedParticipantWorkspaceIdentity({
        user: { id: OWNER, email: 'owner@example.com' },
        participantEmail: 'qa@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
      })
    ).toBe(false);
  });

  it('keeps unauthenticated access unchanged', () => {
    expect(
      evaluateParticipantAccess({
        user: null,
        participantEmail: 'qa@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'read',
        participantId: PARTICIPANT_ID,
        testContext,
      })
    ).toEqual({ status: 'unauthenticated', role: null, accessGrant: null });
  });

  it('still denies a forwarded wrong identity', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: OTHER, email: 'forwarded@example.com' },
        participantEmail: 'qa@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
        participantId: PARTICIPANT_ID,
        portalToken: PORTAL_TOKEN,
        testContext,
      })
    ).toEqual({ status: 'denied', role: null, accessGrant: null });
  });
});

describe('test context wiring isolation', () => {
  it('does not bind on test_context grants', () => {
    const session = readFileSync(
      join(process.cwd(), 'lib/participant-portal/participant-session.server.ts'),
      'utf8'
    );
    expect(session).toContain("decision.accessGrant === 'genuine'");
    expect(session).toContain('bindParticipantAuthenticatedUser');
  });

  it('does not bypass attribution or provenance helpers', () => {
    const attribution = readFileSync(
      join(process.cwd(), 'lib/participants/participant-workspace-attribution.server.ts'),
      'utf8'
    );
    expect(attribution).toContain("role.toUpperCase() !== 'OWNER'");
    expect(attribution).toContain('source_organization_id: { not: null }');
    expect(attribution).not.toContain('testContext');
    expect(attribution).not.toContain('test_context');

    const provenance = readFileSync(
      join(process.cwd(), 'lib/invoices/agreement-invoice-prefill.server.ts'),
      'utf8'
    );
    expect(provenance).toContain('converted_organization_id !== organizationId');
    expect(provenance).not.toContain('accessGrant === \'test_context\'');
  });

  it('does not add a participant origin for conversation invoices', () => {
    const screen = readFileSync(
      join(process.cwd(), 'components/journey/lovable/workspace-create-invoice-screen.tsx'),
      'utf8'
    );
    expect(screen).not.toMatch(/invoiceOrigin:\s*['"]conversation['"]/);
  });

  it('renders the test banner from server accessGrant, not a query param', () => {
    const page = readFileSync(
      join(process.cwd(), 'app/(public)/participant/[token]/page.tsx'),
      'utf8'
    );
    expect(page).toContain("payload.auth.accessGrant === 'test_context'");
    expect(page).toContain('ParticipantTestContextBanner');
    expect(page).not.toContain('searchParams?.get(\'test\')');
  });

  it('does not read public/client env flags', () => {
    const helper = readFileSync(
      join(process.cwd(), 'lib/participant-portal/participant-test-context.ts'),
      'utf8'
    );
    expect(helper).toContain('ENABLE_PARTICIPANT_TEST_CONTEXT');
    expect(helper).toContain('ALLOW_STRIPE_TEST_KEYS');
    expect(helper).not.toContain('NEXT_PUBLIC_DEV_TOOLS');
    expect(helper).not.toContain('NEXT_PUBLIC_ENABLE');
  });

  it('keeps magic-link send-link bound to stored invited email', () => {
    const sendLink = readFileSync(
      join(process.cwd(), 'app/api/participant-portal/[token]/auth/send-link/route.ts'),
      'utf8'
    );
    expect(sendLink).toContain('email: invitedEmail');
    expect(sendLink).not.toContain('testContext');
  });
});
