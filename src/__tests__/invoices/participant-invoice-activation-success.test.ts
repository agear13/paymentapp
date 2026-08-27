import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  isParticipantPortalActivationSuccess,
  ordinaryWorkspaceCreateInvoiceHref,
  PARTICIPANT_ACTIVATION_EVENTS,
} from '@/lib/invoices/participant-activation-analytics';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { log } from '@/lib/logger';
import { POST } from '@/app/api/invoices/activation-analytics/route';

const mockAuth = getCurrentUserForApi as jest.Mock;
const mockOrg = getOrganizationForAuthenticatedUser as jest.Mock;
const mockLog = log.info as jest.Mock;

describe('participant invoice activation success helpers', () => {
  it('only treats server-stamped participant_portal origin as activation', () => {
    expect(isParticipantPortalActivationSuccess('participant_portal')).toBe(true);
    expect(isParticipantPortalActivationSuccess(null)).toBe(false);
    expect(isParticipantPortalActivationSuccess(undefined)).toBe(false);
    expect(isParticipantPortalActivationSuccess('conversation')).toBe(false);
    expect(isParticipantPortalActivationSuccess('manual')).toBe(false);
  });

  it('Create another invoice is ordinary Workspace Create Invoice with no portal context', () => {
    const href = ordinaryWorkspaceCreateInvoiceHref();
    expect(href).toBe(COMMERCIAL_OS_ROUTES.createInvoice);
    expect(href).not.toContain('origin');
    expect(href).not.toContain('sourceParticipantId');
    expect(href).not.toContain('participant');
  });
});

describe('POST /api/invoices/activation-analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: 'user-sarah', email: 'sarah@example.com' },
      response: null,
    });
    mockOrg.mockResolvedValue({ id: 'org-sarah-converted' });
  });

  it('requires authentication', async () => {
    mockAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const response = await POST(
      new NextRequest('http://localhost/api/invoices/activation-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'generate_invoice_clicked' }),
      })
    );
    expect(response.status).toBe(401);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('logs session user and organisation, ignoring client-supplied org/invoice identity', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/invoices/activation-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'workspace_ready_activation_shown',
          properties: {
            organizationId: 'org-other-tenant',
            invoiceId: 'pl-someone-else',
            invoiceOrigin: 'participant_portal',
            amount: 6000,
            customerName: 'Apex Promotions',
            conversationText: 'Client: invoice me $5000',
          },
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(mockOrg).toHaveBeenCalledWith('user-sarah');
    expect(mockLog).toHaveBeenCalledWith(
      'participant.invoice_activation',
      expect.objectContaining({
        userId: 'user-sarah',
        event: 'workspace_ready_activation_shown',
        organizationId: 'org-sarah-converted',
      })
    );
    const logged = JSON.stringify(mockLog.mock.calls[0]);
    expect(logged).not.toContain('org-other-tenant');
    expect(logged).not.toContain('pl-someone-else');
    expect(logged).not.toContain('6000');
    expect(logged).not.toContain('Apex');
    expect(logged).not.toContain('invoice me');
    expect(logged).not.toContain('participant_portal');
  });

  it('rejects unknown events', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/invoices/activation-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'not_a_real_event' }),
      })
    );
    expect(response.status).toBe(400);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('allows the documented funnel events', () => {
    expect(PARTICIPANT_ACTIVATION_EVENTS).toEqual([
      'generate_invoice_clicked',
      'workspace_ready_activation_shown',
      'create_another_invoice_clicked',
    ]);
  });
});

describe('activation success wiring isolation', () => {
  it('success screen keys activation off create-response invoiceOrigin, not the page query', () => {
    const screen = readFileSync(
      join(process.cwd(), 'components/journey/lovable/workspace-create-invoice-screen.tsx'),
      'utf8'
    );
    const success = readFileSync(
      join(process.cwd(), 'components/journey/lovable/create-invoice-success.tsx'),
      'utf8'
    );
    expect(screen).toContain('<CreateInvoiceSuccess');
    expect(screen).toContain('created={created}');
    expect(success).toContain('isParticipantPortalActivationSuccess(created.invoiceOrigin)');
    expect(success).not.toContain('searchParams');
    expect(success).toContain('ordinaryWorkspaceCreateInvoiceHref()');
    expect(success).not.toContain('sourceParticipantId');
    expect(success).not.toContain('agreement-prefill');
  });

  it('does not change attribution attach rules', () => {
    const attach = readFileSync(
      join(process.cwd(), 'lib/participants/participant-workspace-attribution.server.ts'),
      'utf8'
    );
    expect(attach).toContain("role.toUpperCase() !== 'OWNER'");
    expect(attach).toContain('source_organization_id: { not: null }');
    expect(attach).toContain('converted_organization_id: null');
  });

  it('activation analytics is log-only and does not mutate conversion state', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/invoices/activation-analytics/route.ts'),
      'utf8'
    );
    expect(route).toContain("getOrganizationForAuthenticatedUser(auth.user.id)");
    expect(route).not.toContain('prisma');
    expect(route).not.toContain('attachParticipantWorkspaceAttribution');
    expect(route).not.toContain('converted_organization_id');
    expect(route).not.toContain('source_organization_id');
    expect(route).not.toContain('journeyWorkspaceSubscriptionCreate');
    expect(route).not.toContain('invoice_origin');
  });
});
