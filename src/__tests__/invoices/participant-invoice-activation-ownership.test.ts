import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import { createPaymentLinkFromDraft } from '@/lib/payment-links/create-payment-link-from-draft';

describe('existing workspace Create Invoice behaviour', () => {
  it('keeps the blank invoice +14 day due date', () => {
    const draft = defaultCommercialDealDraft('AUD');
    const days = Math.round(
      ((draft.dueDate!.getTime() - draft.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    expect(days).toBe(14);
  });

  it('does not change Door A Create Invoice to require a participant origin', () => {
    const page = readFileSync(
      join(process.cwd(), 'app/(commercial-os)/workspace/receivables/create/page.tsx'),
      'utf8'
    );
    expect(page).toContain('WorkspaceCreateInvoiceScreen');
    expect(page).toContain('origin={params.origin}');
  });
});

describe('participant invoice ownership on create', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the authenticated organization and never a pilotDealId', async () => {
    const posted: Record<string, unknown>[] = [];
    global.fetch = jest.fn(async (_url, init) => {
      posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return {
        ok: true,
        json: async () => ({ data: { id: 'pl-1', shortCode: 'abcd1234' } }),
      } as Response;
    });

    await createPaymentLinkFromDraft('org-sarah-converted', {
      ...defaultCommercialDealDraft('AUD'),
      customerName: 'Apex Promotions Pty Ltd',
      description: 'Producer fee — Saturday Beach Event',
      amount: 6000,
      paymentCollectionMode: 'invoice_only',
    });

    expect(posted).toHaveLength(1);
    expect(posted[0]?.organizationId).toBe('org-sarah-converted');
    expect(posted[0]?.amount).toBe(6000);
    expect(posted[0]).not.toHaveProperty('pilotDealId');
    expect(posted[0]?.organizationId).not.toBe('org-saturday-beach-organiser');
  });

  it('sends only an origin hint for participant portal invoices, never origin IDs or pilotDealId', async () => {
    const posted: Record<string, unknown>[] = [];
    global.fetch = jest.fn(async (_url, init) => {
      posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return {
        ok: true,
        json: async () => ({ data: { id: 'pl-1', shortCode: 'abcd1234' } }),
      } as Response;
    });

    await createPaymentLinkFromDraft(
      'org-sarah-converted',
      {
        ...defaultCommercialDealDraft('AUD'),
        customerName: 'Apex Promotions Pty Ltd',
        description: 'Producer fee — Saturday Beach Event',
        amount: 6000,
        paymentCollectionMode: 'invoice_only',
        dueDate: undefined,
      },
      undefined,
      {
        invoiceOrigin: 'participant_portal',
        sourceParticipantId: 'p-sarah-1',
      }
    );

    expect(posted[0]?.invoiceOrigin).toBe('participant_portal');
    expect(posted[0]?.sourceParticipantId).toBe('p-sarah-1');
    expect(posted[0]).not.toHaveProperty('originParticipantId');
    expect(posted[0]).not.toHaveProperty('originSourceOrganizationId');
    expect(posted[0]).not.toHaveProperty('originDealId');
    expect(posted[0]).not.toHaveProperty('pilotDealId');
    expect(posted[0]?.organizationId).toBe('org-sarah-converted');
  });

  it('Create Invoice origin fetch does not treat query amount as authority', () => {
    const screen = readFileSync(
      join(process.cwd(), 'components/journey/lovable/workspace-create-invoice-screen.tsx'),
      'utf8'
    );
    expect(screen).toContain('/api/invoices/agreement-prefill');
    expect(screen).toContain('applyAgreementInvoicePrefillToDraft');
    expect(screen).toContain('clearStoredInvoiceActivationIntent');
    expect(screen).not.toMatch(/searchParams\.get\(['"]amount['"]\)/);
    expect(screen).toContain('agreementOriginCommercialDealDraft');
    expect(screen).toContain('defaultCommercialDealDraft');
  });

  it('payment-links POST continues to stamp the session org, not client org or organiser deal', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/payment-links/route.ts'), 'utf8');
    expect(route).toContain('delete bodyWithoutClientOrg.organizationId');
    expect(route).toContain('delete bodyWithoutClientOrg.originDealId');
    expect(route).toContain('resolveParticipantPortalInvoiceProvenance');
    expect(route).toContain('getOrganizationForAuthenticatedUser');
    expect(route).toContain('assertPilotDealOwnedByUser');
    expect(route).toContain('invoiceOriginProvenance');
  });

  it('insert stores origin_deal_id separately from pilot_deal_id', () => {
    const insert = readFileSync(
      join(process.cwd(), 'lib/payment-links/create-payment-link-in-tx.ts'),
      'utf8'
    );
    expect(insert).toContain('pilot_deal_id: pilotDealIdToStore');
    expect(insert).toContain('origin_deal_id: invoiceOriginProvenance?.originDealId ?? null');
    expect(insert).not.toMatch(/pilot_deal_id:\s*invoiceOriginProvenance/);
  });
});
