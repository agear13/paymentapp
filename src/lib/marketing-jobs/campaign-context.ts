import type { MarketingCampaignContext } from '@/lib/marketing-jobs/types';
import { MARKETING_DEMO_BRAND, MARKETING_DEMO_TAGLINE } from '@/lib/marketing-jobs/demo-brand';

/**
 * Builds demo campaign context for the Marketing module.
 * Uses Thirsty Turtl as the canonical demo brand.
 */
export function buildDefaultCampaignContext(input: {
  companyId: string;
  companyName: string;
}): MarketingCampaignContext {
  const { companyId } = input;
  const brand = MARKETING_DEMO_BRAND;

  return {
    company: { name: brand },
    campaign: {
      id: `${companyId}:gentle-cleanser-education`,
      title: `${brand} — Gentle Cleanser Education Campaign`,
      type: 'blog',
      businessGoal: 'Educate customers on barrier-friendly daily cleansing routines',
      targetAudience: 'Health-conscious adults with sensitive skin seeking gentle skincare',
    },
    companyBrain: {
      knowledgeFile: 'knowledge.md',
      brandVoice: `${brand} speaks with calm confidence — science-backed, approachable, never clinical. ${MARKETING_DEMO_TAGLINE}`,
      personas:
        'Primary: mindful skincare beginners. Secondary: ingredient-aware customers upgrading from harsh cleansers.',
      messaging:
        'Simple rituals, visible results. Gentle formulas that respect the skin barrier.',
      positioning: `${brand} helps customers build sustainable skincare rituals with turtle-safe, barrier-respecting formulas.`,
      products:
        'Gentle Cleanser, Hydrating Serum, Daily SPF — hero SKUs for education-led campaigns.',
    },
    article: {
      title: '10 Simple Ways to Add a Gentle Cleanser to Your Routine',
      summary:
        'A practical guide showing how a gentle cleanser fits morning and evening rituals without disrupting sensitive skin.',
      outline: [
        'Why barrier-friendly cleansing matters',
        'Morning vs evening application',
        'Pairing with hydration and SPF',
        'Common mistakes to avoid',
        'Building a sustainable 7-day habit',
      ],
    },
    copy: {
      headline: '10 Simple Ways to Add a Gentle Cleanser to Your Routine',
      subheadline: 'Barrier-friendly cleansing for calm, confident skin — every day.',
      cta: 'Shop the Gentle Cleanser',
      socialCaption:
        'Small ritual, big difference. Here are 10 simple ways to introduce a gentle cleanser without overcomplicating your routine.',
      newsletterIntro:
        'This month we are focusing on gentle cleansing — the foundation of every effective skincare routine.',
    },
    seo: {
      primaryKeyword: 'gentle cleanser routine',
      secondaryKeywords: [
        'barrier-friendly skincare',
        'daily cleansing tips',
        'sensitive skin cleanser',
      ],
      metaDescription:
        'Learn 10 simple ways to add a gentle cleanser to your daily skincare routine without disrupting sensitive skin.',
    },
    visualRecommendations: {
      instagramCarousel: {
        format: '1080×1350 carousel (5 slides)',
        dimensions: '1080×1350',
        concept: 'Step-by-step routine cards with product flat-lay photography',
        notes: 'Use soft natural light, muted earth tones, minimal text per slide',
      },
      facebook: {
        format: '1200×630 link preview',
        dimensions: '1200×630',
        concept: 'Hero product with headline overlay and subtle texture background',
        notes: 'Keep headline under 8 words for mobile legibility',
      },
      pinterest: {
        format: '1000×1500 pin',
        dimensions: '1000×1500',
        concept: 'Vertical infographic summarising the 10 tips',
        notes: 'Include numbered steps and brand logo lockup at base',
      },
      stories: {
        format: '1080×1920 story sequence',
        dimensions: '1080×1920',
        concept: '3-frame story: hook → tip highlight → CTA swipe-up',
        notes: 'Use motion-safe safe zones; CTA on final frame only',
      },
      newsletterHeader: {
        format: '600×200 email header',
        dimensions: '600×200',
        concept: 'Wide banner with product trio and campaign title',
        notes: 'Optimise for dark and light email clients',
      },
    },
  };
}
