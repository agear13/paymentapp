import fs from 'fs';
import path from 'path';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { PLAN_CATALOG } from '@/lib/plans/plan-catalog';
import { PROFESSIONAL_TRIAL_DAYS } from '@/lib/entitlements/professional-trial';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import {
  INVOICE_ACQUISITION_LANDING_PATH,
  INVOICE_LANDING_FAQS,
  INVOICE_LANDING_METADATA,
  INVOICE_LANDING_OFFER_LINE,
  INVOICE_LANDING_PAYMENT_ROUTES,
  INVOICE_LANDING_TRIAL_CTA_HREF,
  INVOICE_LANDING_TRIAL_DAYS,
  INVOICE_LANDING_WORKFLOWS,
  invoiceLandingWorkflows,
  professionalIncludesPaymentLinks,
  professionalIncludesReferralManagement,
  professionalIncludesXero,
} from '@/lib/journey/invoice-acquisition-landing';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('invoice acquisition landing copy', () => {
  const page = read('app/invoice/page.tsx');
  const ui = read('components/journey/lovable/invoice-acquisition-page.tsx');
  const creator = read('components/journey/lovable/guest-invoice-creator.tsx');
  const copy = read('lib/journey/invoice-acquisition-landing.ts');
  const homepage = read('components/journey/lovable/journey-landing-page.tsx');
  const workspaceCreate = read('components/journey/lovable/workspace-create-invoice-screen.tsx');

  it('is a dedicated public route with the requested SEO metadata', () => {
    expect(page).toContain("from '@/components/journey/lovable/invoice-acquisition-page'");
    expect(page).toContain('INVOICE_LANDING_METADATA.title');
    expect(page).toContain('application/ld+json');
    expect(INVOICE_ACQUISITION_LANDING_PATH).toBe('/invoice');
    expect(INVOICE_LANDING_METADATA.title).toBe(
      'Free Invoice Generator | Create & Download Invoices | Provvy'
    );
    expect(INVOICE_LANDING_METADATA.description).toContain('free forever');
    expect(INVOICE_LANDING_METADATA.description).toContain('payment links');
  });

  it('uses the existing Professional trial and assessment signup route', () => {
    expect(INVOICE_LANDING_TRIAL_CTA_HREF).toBe(COMMERCIAL_OS_ROUTES.assessment);
    expect(INVOICE_LANDING_TRIAL_CTA_HREF).toBe('/journey/assessment');
    expect(INVOICE_LANDING_TRIAL_DAYS).toBe(PROFESSIONAL_TRIAL_DAYS);
    expect(INVOICE_LANDING_TRIAL_DAYS).toBe(30);
    expect(professionalIncludesPaymentLinks()).toBe(true);
    expect(professionalIncludesXero()).toBe(true);
    expect(professionalIncludesReferralManagement()).toBe(true);
    expect(PLAN_CATALOG.professional.features).toEqual(
      expect.arrayContaining(['Payment Links', 'Xero', 'Referral Management'])
    );
    expect(ui).toContain('INVOICE_LANDING_TRIAL_CTA_HREF');
    expect(ui).toContain("persistJourneyObjective(INVOICE_LANDING_OBJECTIVE)");
    expect(ui).toContain("persistJourneyBusiness({ accounting: 'Xero' })");
  });

  it('does not invent trial terms, unsupported accounting, or a new auth system', () => {
    const surface = `${copy}\n${ui}\n${page}\n${creator}`;
    expect(surface).not.toMatch(/credit card/i);
    expect(surface).not.toMatch(/no credit card/i);
    expect(surface).not.toMatch(/cancel any time/i);
    expect(surface).not.toMatch(/cancellation/i);
    expect(surface).not.toMatch(/setup fee/i);
    expect(surface).not.toMatch(/\$49/);
    expect(surface).not.toMatch(/money[- ]back/i);
    expect(surface).not.toMatch(/QuickBooks|MYOB|NetSuite/);
    expect(surface).not.toMatch(/lending|financing/i);
    expect(ui).not.toContain('/auth/signup');
    expect(ui).not.toContain('LandingAdvisor');
  });

  it('keeps payment rails inside the live Create Invoice labels', () => {
    expect(INVOICE_LANDING_PAYMENT_ROUTES).toEqual([
      'Credit / debit card',
      'Bank transfer',
      'Wise checkout',
      'HashPack',
      'MetaMask',
    ]);
  });

  it('reuses live workflow library routes', () => {
    expect(INVOICE_LANDING_WORKFLOWS.slugs).toEqual([
      'revenue-sharing',
      'supplier-payments',
      'referral-management',
      'commercial-operations',
      'autonomous-reconciliation',
    ]);
    for (const slug of INVOICE_LANDING_WORKFLOWS.slugs) {
      expect(getWorkflowBySlug(slug)).toBeTruthy();
    }
    expect(invoiceLandingWorkflows().map((item) => item.href)).toEqual([
      '/journey/workflows/revenue-sharing',
      '/journey/workflows/supplier-payments',
      '/journey/workflows/referral-management',
      '/journey/workflows/commercial-operations',
      '/journey/workflows/autonomous-reconciliation',
    ]);
  });

  it('does not duplicate the workspace invoice engine and leaves the homepage intact', () => {
    expect(creator).toContain('/api/public/invoices/conversation-prefill');
    expect(creator).toContain('applyConversationInvoiceExtractionToDraft');
    expect(creator).toContain('InvoiceCreationMethodToggle');
    expect(creator).not.toContain('createPaymentLinkFromDraft');
    expect(workspaceCreate).toContain('/api/invoices/conversation-prefill');
    expect(homepage).toContain('The Skyscanner for payments.');
    expect(homepage).not.toContain('InvoiceAcquisitionPage');
    expect(homepage).not.toContain('Create invoices for free.');
  });

  it('answers the SEO FAQ set', () => {
    expect(INVOICE_LANDING_FAQS.map((item) => item.question)).toEqual([
      "Is Provvy's invoice generator free?",
      'Can I download invoices without creating an account?',
      'Can I create an invoice from a conversation?',
      'Can I turn my invoice into a payment link?',
      'Can I connect Xero?',
      'What does the 30-day Professional trial include?',
      "How does Provvy's commercial intelligence work?",
      'Can Provvy suggest better payment terms?',
      'Can I use Provvy to manage referral or revenue-sharing arrangements?',
    ]);
    expect(INVOICE_LANDING_OFFER_LINE).toMatch(/No account required/i);
    expect(INVOICE_LANDING_FAQS[5].answer).toContain('Payment Links');
    expect(INVOICE_LANDING_FAQS[5].answer).toContain('Xero');
    expect(INVOICE_LANDING_FAQS[5].answer).toContain('Referral Management');
  });
});
