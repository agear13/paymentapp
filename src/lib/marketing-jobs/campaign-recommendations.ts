import type { MarketingCampaignContext, NextCampaignRecommendation } from '@/lib/marketing-jobs/types';
import { MARKETING_DEMO_BRAND } from '@/lib/marketing-jobs/demo-brand';

/** Deterministic next-campaign recommendation — replace with AI engine in Phase 3+. */
export const NEXT_CAMPAIGN_RECOMMENDATION: NextCampaignRecommendation = {
  id: 'next-sensitive-skin-cleansing',
  topic: '5 Mistakes People Make When Cleansing Sensitive Skin',
  reasons: [
    'High topical relevance',
    'Supports existing SEO cluster',
    'Frequently asked by customers',
  ],
  estimatedOrganicTraffic: 2_800,
  estimatedAssets: 11,
  estimatedProductionMinutes: 63,
  businessGoal: 'Increase educational traffic',
};

export function buildNextCampaignRecommendation(): NextCampaignRecommendation {
  return NEXT_CAMPAIGN_RECOMMENDATION;
}

export function buildRecommendedCampaignContext(
  input: { companyId: string; companyName: string },
  recommendation: NextCampaignRecommendation
): MarketingCampaignContext {
  const brand = MARKETING_DEMO_BRAND;

  return {
    company: { name: brand },
    campaign: {
      id: `${input.companyId}:${recommendation.id}`,
      title: `${brand} — ${recommendation.topic}`,
      type: 'blog',
      businessGoal: recommendation.businessGoal,
      targetAudience: 'Adults with sensitive skin seeking gentle, barrier-respecting routines',
    },
    companyBrain: {
      knowledgeFile: 'knowledge.md',
      brandVoice: `${brand} speaks with calm confidence — science-backed, approachable, never clinical.`,
      personas:
        'Primary: sensitive-skin beginners. Secondary: ingredient-aware customers avoiding harsh cleansers.',
      messaging: 'Gentle cleansing protects the barrier. Avoid common mistakes that cause irritation.',
      positioning: `${brand} helps customers cleanse effectively without compromising skin barrier health.`,
      products:
        'Gentle Cleanser, Barrier Repair Serum, Daily SPF — education-led sensitive skin portfolio.',
    },
    article: {
      title: recommendation.topic,
      summary:
        'A practical guide to the five most common cleansing mistakes — and how to fix them for calm, healthy skin.',
      outline: [
        'Over-cleansing and barrier damage',
        'Using water that is too hot',
        'Skipping patch tests with new products',
        'Rubbing instead of patting dry',
        'Inconsistent morning vs evening routines',
      ],
    },
    copy: {
      headline: recommendation.topic,
      subheadline: 'Protect your skin barrier with smarter cleansing habits.',
      cta: 'Shop the Gentle Cleanser',
      socialCaption:
        'Sensitive skin? These 5 cleansing mistakes might be holding you back. Here is what to do instead.',
      newsletterIntro:
        'This week we are tackling the most common cleansing mistakes for sensitive skin — and simple fixes.',
    },
    seo: {
      primaryKeyword: 'cleansing sensitive skin mistakes',
      secondaryKeywords: [
        'gentle cleanser tips',
        'skin barrier cleansing',
        'sensitive skin routine',
      ],
      metaDescription:
        'Avoid these 5 common cleansing mistakes when you have sensitive skin — and build a barrier-friendly routine.',
    },
    visualRecommendations: {
      instagramCarousel: {
        format: '1080×1350 carousel (5 slides)',
        dimensions: '1080×1350',
        concept: 'Mistake vs fix comparison cards with soft photography',
        notes: 'One mistake per slide; muted palette; minimal text',
      },
      facebook: {
        format: '1200×630 link preview',
        dimensions: '1200×630',
        concept: 'Bold headline with before/after routine illustration',
        notes: 'Educational tone; no fear-based messaging',
      },
      pinterest: {
        format: '1000×1500 pin',
        dimensions: '1000×1500',
        concept: 'Checklist infographic of 5 mistakes',
        notes: 'Numbered list; brand lockup at base',
      },
      stories: {
        format: '1080×1920 story sequence',
        dimensions: '1080×1920',
        concept: 'Quick-tip story frames with poll sticker placement',
        notes: 'Hook on frame 1; CTA on final frame',
      },
      newsletterHeader: {
        format: '600×200 email header',
        dimensions: '600×200',
        concept: 'Clean banner with campaign title and product accent',
        notes: 'Optimise for light and dark email clients',
      },
    },
  };
}
