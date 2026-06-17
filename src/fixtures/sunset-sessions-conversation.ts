/**
 * Sunset Sessions — permanent regression fixture for multi-party event extraction.
 */
export const SUNSET_SESSIONS_CONVERSATION = `James:
Team — locking terms for Sunset Sessions. Total event budget is $8,000 (operational only, not individual payouts).

Sarah (marketing/promotions):
- Influencer outreach, local partnerships, social media promotion
- 10% of bar revenue on the night

Alex (photography):
- Event photography, artist photos, crowd shots, 50 edited images
- $600 fixed + $150 bonus if attendance exceeds 500

Mia (videography):
- Event recap video, 3 social media reels, drone footage
- 5% of ticket revenue

Chris (graphic design):
- Main event poster, Instagram story templates, ticket banner graphics, sponsor assets
- $900 fixed design fee

Ben (venue):
- Venue hosting and bar operations
- 15% of bar revenue`;

export const SUNSET_SESSIONS_EXPECTATIONS = {
  participantCount: 5,
  categories: {
    Sarah: 'MARKETING',
    Alex: 'PHOTOGRAPHY',
    Mia: 'VIDEOGRAPHY',
    Chris: 'GRAPHIC_DESIGN',
    Ben: 'VENUE',
  },
  compensation: {
    Alex: { fixedFee: 600, conditionalAmount: 150 },
    Sarah: { revenueSharePct: 10 },
    Mia: { revenueSharePct: 5 },
    Ben: { revenueSharePct: 15 },
  },
  deliverables: {
    Alex: ['Event photography', 'Artist photos', 'Crowd shots', '50 edited images'],
    Mia: ['Event recap video', '3 social media reels', 'Drone footage'],
    Chris: [
      'Main event poster',
      'Instagram story templates',
      'Ticket banner graphics',
      'Sponsor assets',
    ],
    Sarah: ['Influencer outreach', 'Local partnerships', 'Social media promotion'],
  },
  agreementType: 'MULTI_PARTY_EVENT_COORDINATION',
  maxReadinessScore: 89,
} as const;

function field<T>(
  value: T,
  confidence: 'high' | 'medium' | 'low' | 'absent' = 'high',
  rawSnippet?: string
) {
  return rawSnippet ? { value, confidence, rawSnippet } : { value, confidence };
}

function deliverable(description: string, category: string) {
  return {
    description: field(description),
    category: field(category),
  };
}

/** Ideal model-shaped payload for Sunset Sessions (schema v4). */
export function sunsetSessionsIdealExtractionPayload(): Record<string, unknown> {
  return {
    schemaVersion: 'v4',
    projectName: field('Sunset Sessions'),
    projectDescription: field('Multi-party beach club event coordination'),
    projectValue: field(8000, 'medium'),
    currency: field(null, 'absent'),
    counterparty: field('James'),
    agreementType: field('MULTI_PARTY_EVENT_COORDINATION'),
    parties: [
      {
        id: 'ep-1',
        name: field('Sarah'),
        email: field(null, 'absent'),
        role: field('Marketing'),
        participationModel: field('revenue_share'),
        fixedAmount: field(null, 'absent'),
        revenueSharePct: field(10, 'high'),
        deliverables: [
          deliverable('Influencer outreach', 'MARKETING'),
          deliverable('Local partnerships', 'MARKETING'),
          deliverable('Social media promotion', 'MARKETING'),
        ],
        conditionalPayments: [],
        serviceCategories: field(['MARKETING']),
        milestones: [],
        conditions: [],
        dependencies: [],
        notes: field(null, 'absent'),
      },
      {
        id: 'ep-2',
        name: field('Alex'),
        email: field(null, 'absent'),
        role: field('Photographer'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(600, 'high'),
        revenueSharePct: field(null, 'absent'),
        deliverables: [
          deliverable('Event photography', 'PHOTOGRAPHY'),
          deliverable('Artist photos', 'PHOTOGRAPHY'),
          deliverable('Crowd shots', 'PHOTOGRAPHY'),
          deliverable('50 edited images', 'PHOTOGRAPHY'),
        ],
        conditionalPayments: [
          {
            trigger: field('attendance exceeds 500', 'high', 'bonus if attendance exceeds 500'),
            amount: field(150, 'high'),
            rawSnippet: '$150 bonus if attendance exceeds 500',
          },
        ],
        serviceCategories: field(['PHOTOGRAPHY']),
        milestones: [],
        conditions: [],
        dependencies: [],
        notes: field(null, 'absent'),
      },
      {
        id: 'ep-3',
        name: field('Mia'),
        email: field(null, 'absent'),
        role: field('Videographer'),
        participationModel: field('revenue_share'),
        fixedAmount: field(null, 'absent'),
        revenueSharePct: field(5, 'high'),
        deliverables: [
          deliverable('Event recap video', 'VIDEOGRAPHY'),
          deliverable('3 social media reels', 'VIDEOGRAPHY'),
          deliverable('Drone footage', 'VIDEOGRAPHY'),
        ],
        conditionalPayments: [],
        serviceCategories: field(['VIDEOGRAPHY']),
        milestones: [],
        conditions: [],
        dependencies: [],
        notes: field(null, 'absent'),
      },
      {
        id: 'ep-4',
        name: field('Chris'),
        email: field(null, 'absent'),
        role: field('Designer'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(900, 'high'),
        revenueSharePct: field(null, 'absent'),
        deliverables: [
          deliverable('Main event poster', 'GRAPHIC_DESIGN'),
          deliverable('Instagram story templates', 'GRAPHIC_DESIGN'),
          deliverable('Ticket banner graphics', 'GRAPHIC_DESIGN'),
          deliverable('Sponsor assets', 'GRAPHIC_DESIGN'),
        ],
        conditionalPayments: [],
        serviceCategories: field(['GRAPHIC_DESIGN']),
        milestones: [],
        conditions: [],
        dependencies: [],
        notes: field(null, 'absent'),
      },
      {
        id: 'ep-5',
        name: field('Ben'),
        email: field(null, 'absent'),
        role: field('Venue'),
        participationModel: field('revenue_share'),
        fixedAmount: field(null, 'absent'),
        revenueSharePct: field(15, 'high'),
        deliverables: [],
        conditionalPayments: [],
        serviceCategories: field(['VENUE']),
        milestones: [],
        conditions: [],
        dependencies: [],
        notes: field('Venue hosting and bar operations', 'medium'),
      },
    ],
    settlementRules: [],
    paymentTerms: [],
    uncertainties: [{ field: 'currency', issue: 'Currency not explicitly stated in conversation' }],
    overallConfidence: 'medium',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-17T00:00:00.000Z',
  };
}

/** Simulates incorrect generic-role extraction observed in production. */
export function sunsetSessionsGenericRolePayload(): Record<string, unknown> {
  const ideal = sunsetSessionsIdealExtractionPayload();
  const parties = (ideal.parties as Record<string, unknown>[]).map((party, index) => {
    const genericRoles = ['Promoter', 'Promoter', 'Promoter', 'Performer', 'Promoter'];
    return {
      ...party,
      role: field(genericRoles[index]),
      serviceCategories: field([]),
    };
  });
  return { ...ideal, parties };
}
