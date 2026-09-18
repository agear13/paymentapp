import fs from 'fs';
import path from 'path';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { PLAN_CATALOG } from '@/lib/plans/plan-catalog';
import { PROFESSIONAL_TRIAL_DAYS } from '@/lib/entitlements/professional-trial';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import {
  professionalIncludesReferralManagement,
  referralLandingBusinesses,
  referralLandingPayoutRoutesAreCatalogued,
  referralManagementWorkflowExists,
  REFERRAL_LANDING_FAQS,
  REFERRAL_LANDING_FEATURES,
  REFERRAL_LANDING_METADATA,
  REFERRAL_LANDING_OFFER_LINE,
  REFERRAL_LANDING_PAYOUT_ROUTES,
  REFERRAL_LANDING_TRIAL_CTA_HREF,
  REFERRAL_LANDING_TRIAL_DAYS,
  REFERRAL_LANDING_WORKFLOW,
} from '@/lib/journey/referral-management-landing';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('referral management acquisition landing', () => {
  const page = read('app/referral-management/page.tsx');
  const ui = read('components/journey/lovable/referral-management-landing-page.tsx');
  const copy = read('lib/journey/referral-management-landing.ts');
  const homepage = read('components/journey/lovable/journey-landing-page.tsx');
  const workflow = getWorkflowBySlug('referral-management');

  it('is a dedicated public route with the requested SEO metadata', () => {
    expect(page).toContain("from '@/components/journey/lovable/referral-management-landing-page'");
    expect(page).toContain('REFERRAL_LANDING_METADATA.title');
    expect(page).toContain('application/ld+json');
    expect(REFERRAL_LANDING_METADATA.title).toBe('Referral Management Software | Provvy');
    expect(REFERRAL_LANDING_METADATA.description).toContain('Try Professional free for 30 days');
    expect(REFERRAL_LANDING_METADATA.description).toContain('referral programs');
  });

  it('uses the existing Professional trial and assessment signup route', () => {
    expect(REFERRAL_LANDING_TRIAL_CTA_HREF).toBe(COMMERCIAL_OS_ROUTES.assessment);
    expect(REFERRAL_LANDING_TRIAL_CTA_HREF).toBe('/journey/assessment');
    expect(REFERRAL_LANDING_TRIAL_DAYS).toBe(PROFESSIONAL_TRIAL_DAYS);
    expect(REFERRAL_LANDING_TRIAL_DAYS).toBe(30);
    expect(professionalIncludesReferralManagement()).toBe(true);
    expect(PLAN_CATALOG.professional.features).toContain('Referral Management');
    expect(REFERRAL_LANDING_OFFER_LINE).toBe('30 days free · Professional package');
    expect(ui).toContain('REFERRAL_LANDING_TRIAL_CTA_HREF');
    expect(ui).toContain("persistJourneyObjective('revenue-share')");
  });

  it('does not invent trial terms, competitor claims or a new auth system', () => {
    const surface = `${copy}\n${ui}\n${page}`;
    expect(surface).not.toMatch(/credit card/i);
    expect(surface).not.toMatch(/no credit card/i);
    expect(surface).not.toMatch(/cancel any time/i);
    expect(surface).not.toMatch(/cancellation/i);
    expect(surface).not.toMatch(/setup fee/i);
    expect(surface).not.toMatch(/\$49/);
    expect(surface).not.toMatch(/money[- ]back/i);
    expect(surface).not.toMatch(/unlimited partners/i);
    expect(surface).not.toMatch(/impact\.com|partnerstack|rewardful|refersion/i);
    expect(ui).not.toContain('/auth/signup');
    expect(ui).not.toContain('LandingAdvisor');
  });

  it('keeps workflow claims inside the live Referral Management product', () => {
    expect(referralManagementWorkflowExists()).toBe(true);
    expect(workflow?.capabilities).toEqual(
      expect.arrayContaining([
        'Issue existing referral links and QR codes',
        'Attribute referred checkout revenue',
        'Open Settlement for owed commissions',
      ])
    );
    expect(REFERRAL_LANDING_WORKFLOW.steps[4]?.title).toMatch(/coordinate/i);
    expect(REFERRAL_LANDING_FEATURES.items.map((item) => item.title)).toEqual([
      'Referral links',
      'Partner management',
      'Referral attribution',
      'Commission rules',
      'Commission tracking',
      'Partner payouts',
    ]);
    expect(copy).toContain('Provvy does not silently extract');
    expect(copy).toContain('does not automatically execute every payout');
  });

  it('only lists payment routes that exist in the public catalog', () => {
    expect(referralLandingPayoutRoutesAreCatalogued()).toBe(true);
    expect(REFERRAL_LANDING_PAYOUT_ROUTES).toEqual([
      'Wise',
      'Bank transfer',
      'Digital-dollar transfer',
    ]);
  });

  it('reuses existing business-flow proof without invented customer metrics', () => {
    const businesses = referralLandingBusinesses();
    expect(businesses.map((item) => item.business)).toEqual([
      'Weso',
      'Thirsty Turtl',
      'The Collective',
    ]);
    expect(businesses.every((item) => item.href)).toBe(true);
    expect(`${copy}\n${ui}`).not.toMatch(/trusted by/i);
    expect(`${copy}\n${ui}`).not.toMatch(/testimonial/i);
    expect(`${copy}\n${ui}`).not.toMatch(/\d{2,}\+ customers/i);
  });

  it('covers the SEO FAQ set with product-accurate answers', () => {
    expect(REFERRAL_LANDING_FAQS.map((item) => item.question)).toEqual([
      'What is referral management software?',
      'How do I track referral partners?',
      'How do I calculate referral commissions?',
      'Can each partner have their own referral link?',
      'Can I manage different commission rates?',
      'Can Provvy manage revenue-sharing arrangements?',
      'Can Provvy manage affiliate and influencer programs?',
      'How does the 30-day free Professional trial work?',
      'Can I manage partner payouts in Provvy?',
      'Can Provvy connect referral activity to payment workflows?',
    ]);
    expect(REFERRAL_LANDING_FAQS.some((item) => item.answer.includes('QR code'))).toBe(true);
  });

  it('does not change the existing homepage', () => {
    expect(homepage).toContain('The Skyscanner for payments.');
    expect(homepage).toContain('Start with 30 days of Professional.');
    expect(homepage).not.toContain('ReferralManagementLandingPage');
    expect(homepage).not.toContain('referral-management-landing');
  });
});
