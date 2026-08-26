import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  conversationOriginCommercialDealDraft,
  defaultCommercialDealDraft,
} from '@/lib/commercial-os/commercial-deal-draft';
import {
  applyConversationInvoiceExtractionToDraft,
  sanitizeConversationInvoiceExtraction,
} from '@/lib/invoices/conversation-invoice-extraction';
import { createPaymentLinkFromDraft } from '@/lib/payment-links/create-payment-link-from-draft';

describe('conversation extraction create path', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates through createPaymentLinkFromDraft with normal invoice fields only', async () => {
    const posted: Record<string, unknown>[] = [];
    global.fetch = jest.fn(async (_url, init) => {
      posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return {
        ok: true,
        json: async () => ({ data: { id: 'pl-1', shortCode: 'abcd1234' } }),
      } as Response;
    });

    const extraction = sanitizeConversationInvoiceExtraction({
      customerName: 'Apex Promotions',
      description: 'Event production services',
      amount: 5000,
      currency: 'AUD',
      dueDate: '2026-09-15',
    });
    const draft = applyConversationInvoiceExtractionToDraft(
      extraction,
      conversationOriginCommercialDealDraft('AUD')
    );

    await createPaymentLinkFromDraft('org-workspace', {
      ...draft,
      paymentCollectionMode: 'invoice_only',
    });

    expect(posted).toHaveLength(1);
    expect(posted[0]?.organizationId).toBe('org-workspace');
    expect(posted[0]?.amount).toBe(5000);
    expect(posted[0]?.description).toBe('Event production services');
    expect(posted[0]?.customerName).toBe('Apex Promotions');
    expect(posted[0]).not.toHaveProperty('conversationText');
    expect(posted[0]).not.toHaveProperty('invoiceOrigin');
    expect(posted[0]).not.toHaveProperty('sourceParticipantId');
    expect(posted[0]).not.toHaveProperty('extractionId');
    expect(posted[0]).not.toHaveProperty('pilotDealId');
    expect(JSON.stringify(posted[0])).not.toMatch(/Client:|WhatsApp|invoice_origin/);
  });

  it('does not let a client-injected amount bypass sanitization on apply', () => {
    const draft = applyConversationInvoiceExtractionToDraft(
      {
        amount: 99999,
        amountAmbiguous: true,
        amountCandidates: [
          { kind: 'amount', label: '$2,000 deposit', amount: 2000 },
          { kind: 'amount', label: '$5,000 total', amount: 5000 },
        ],
        customerName: 'Apex Promotions',
        description: 'Event production',
        invoiceOrigin: 'participant_portal',
      },
      conversationOriginCommercialDealDraft('AUD')
    );
    expect(draft.amount).toBeUndefined();
    expect(draft.customerName).toBe('Apex Promotions');
  });
});

describe('conversation mode stays off participant portal Create Invoice', () => {
  it('hides paste UI on agreement origin and does not mix prefill with extraction', () => {
    const screen = readFileSync(
      join(process.cwd(), 'components/journey/lovable/workspace-create-invoice-screen.tsx'),
      'utf8'
    );
    expect(screen).toContain('showCreationMethodToggle={!isAgreementOrigin}');
    expect(screen).toContain('InvoiceCreationMethodToggle');
    expect(screen).toContain('/api/invoices/conversation-prefill');
    expect(screen).toContain('createPaymentLinkFromDraft');
    expect(screen).toContain('applyAgreementInvoicePrefillToDraft');
    expect(screen).toContain('JSON.stringify({ conversationText })');
    expect(screen).not.toContain('Start with AI');
    expect(screen).not.toContain('Coming soon');
    expect(screen).not.toContain('/api/ai-extractor/extract');
    expect(screen).not.toContain('extractAgreementFromText');
    expect(screen).not.toMatch(/invoiceOrigin:\s*['"]conversation['"]/);
    expect(screen).not.toMatch(/body\.conversationText/);
  });

  it('Door A blank create still uses the +14 day factory', () => {
    const draft = defaultCommercialDealDraft('AUD');
    const days = Math.round(
      ((draft.dueDate!.getTime() - draft.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    expect(days).toBe(14);
  });
});

describe('conversation extraction isolation', () => {
  it('does not call Agreement Intelligence or persist conversation text', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/invoices/conversation-prefill/route.ts'),
      'utf8'
    );
    const server = readFileSync(
      join(process.cwd(), 'lib/invoices/conversation-invoice-extraction.server.ts'),
      'utf8'
    );
    expect(route).toContain('extractConversationInvoiceFromText');
    expect(route).not.toContain('ai_import');
    expect(route).not.toContain('prisma');
    expect(route).not.toContain('extractAgreementFromText');
    expect(route).not.toContain('/api/ai-extractor/extract');
    expect(server).not.toContain('extractAgreementFromText');
    expect(server).not.toContain('agreement-analyzer');
    expect(server).toContain('conversation_invoice_extraction');
    expect(server).not.toContain('input.amount');
    expect(server).not.toMatch(/log\.(info|error).*conversationText/);
  });
});
