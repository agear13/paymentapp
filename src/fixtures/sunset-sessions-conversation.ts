/**
 * Sunset Sessions — permanent regression fixture for multi-party event extraction (v5).
 */
export const SUNSET_SESSIONS_CONVERSATION = `James:
Team — locking terms for Sunset Sessions. I'll coordinate suppliers, negotiate terms, approve payments and run the event.

Sarah (marketing):
- Influencer outreach, local partnerships, social media promotion, track SARAH10 referrals
- $300 fixed fee
- 10% of ticket revenue via SARAH10 code
- Paid within 7 days after event

Alex (photography):
- Event photography, artist photos, crowd shots, 50 edited images
- $600 fixed fee
- $150 bonus if attendance exceeds 500
- Paid within 14 days after event

Mia (videography):
- Event recap video, 3 social media reels, drone footage
- $500 before event
- $500 after event (7 days after event)
- 5% of sponsorship revenue once sponsor funds clear (14 days after sponsor funds clear)

Chris (graphic design):
- Main event poster, Instagram story templates, ticket banner graphics, sponsor assets
- $250 on agreement commencement
- $250 on final asset delivery by 30 July

Ben (venue):
- Venue hosting and bar operations
- $1,200 fixed fee
- 15% of bar revenue
- Paid within 7 days after event`;

export const SUNSET_SESSIONS_EXPECTATIONS = {
  participantCount: 5,
  agreementOwner: 'James',
  categories: {
    Sarah: 'MARKETING',
    Alex: 'PHOTOGRAPHY',
    Mia: 'VIDEOGRAPHY',
    Chris: 'GRAPHIC_DESIGN',
    Ben: 'VENUE',
  },
  compensation: {
    Sarah: { fixedFee: 300, revenueSharePct: 10 },
    Alex: { fixedFee: 600, conditionalAmount: 150 },
    Mia: { instalments: [500, 500], revenueSharePct: 5 },
    Chris: { milestones: [250, 250] },
    Ben: { fixedFee: 1200, revenueSharePct: 15 },
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
    Sarah: [
      'Influencer outreach',
      'Local partnerships',
      'Social media promotion',
      'Track SARAH10 referrals',
    ],
  },
  dependencies: {
    Alex: 'attendance exceeds 500',
    Mia: 'sponsor funds clear',
    Chris: 'final asset delivery',
  },
  agreementType: 'MULTI_PARTY_EVENT_COORDINATION',
  estimatedFixedCommitment: 3600,
  maxReadinessScore: 89,
  hybridParticipants: ['Sarah', 'Ben'],
  milestoneCount: 2,
  instalmentCount: 2,
  conditionalCount: 1,
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

function compensationTerm(
  id: string,
  type: string,
  label: string,
  amount: number | null,
  percentage: number | null,
  trigger: string | null,
  options?: { sequenceIndex?: number; deadline?: string; revenueBasis?: string }
) {
  return {
    id,
    type,
    label: field(label),
    amount: field(amount),
    percentage: field(percentage),
    trigger: field(trigger),
    deadline: field(options?.deadline ?? null, 'absent'),
    revenueBasis: field(options?.revenueBasis ?? null, 'absent'),
    sequenceIndex: options?.sequenceIndex ?? null,
    confidence: 'high' as const,
  };
}

/** Ideal model-shaped payload for Sunset Sessions (schema v5). */
export function sunsetSessionsIdealExtractionPayload(): Record<string, unknown> {
  return {
    schemaVersion: 'v5',
    projectName: field('Sunset Sessions'),
    projectDescription: field('Multi-party beach club event coordination'),
    projectValue: field(8000, 'medium'),
    currency: field('AUD', 'medium'),
    counterparty: field('James', 'high', "I'll coordinate suppliers"),
    agreementType: field('MULTI_PARTY_EVENT_COORDINATION'),
    agreementOwner: {
      name: field('James'),
      responsibilities: [
        field('Coordinates suppliers'),
        field('Negotiates commercial terms'),
        field('Approves payments'),
        field('Organises event delivery'),
      ],
    },
    parties: [
      {
        id: 'ep-1',
        name: field('Sarah'),
        email: field(null, 'absent'),
        role: field('Marketing'),
        participationModel: field('hybrid'),
        fixedAmount: field(300, 'high'),
        revenueSharePct: field(10, 'high'),
        deliverables: [
          deliverable('Influencer outreach', 'MARKETING'),
          deliverable('Local partnerships', 'MARKETING'),
          deliverable('Social media promotion', 'MARKETING'),
          deliverable('Track SARAH10 referrals', 'MARKETING'),
        ],
        compensationTerms: [
          compensationTerm('ep-1-fixed-1', 'fixed_fee', 'Fixed fee', 300, null, null),
          compensationTerm(
            'ep-1-rev-1',
            'revenue_share',
            'Revenue share',
            null,
            10,
            'Within 7 days after event',
            { revenueBasis: 'ticket revenue via SARAH10' }
          ),
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
        compensationTerms: [
          compensationTerm(
            'ep-2-fixed-1',
            'fixed_fee',
            'Fixed fee',
            600,
            null,
            'Within 14 days after event'
          ),
          compensationTerm(
            'ep-2-bonus-1',
            'conditional_bonus',
            'Conditional bonus',
            150,
            null,
            'Attendance exceeds 500'
          ),
        ],
        conditionalPayments: [
          {
            trigger: field('attendance exceeds 500', 'high', 'bonus if attendance exceeds 500'),
            amount: field(150, 'high'),
            rawSnippet: '$150 bonus if attendance exceeds 500',
          },
        ],
        commercialDependencies: [
          {
            id: 'ep-2-dep-1',
            description: field('Attendance exceeds 500'),
            type: field('attendance_threshold'),
            blocksSettlement: field(true),
            relatedCompensationId: field('ep-2-bonus-1'),
            relatedDeliverableId: field(null, 'absent'),
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
        participationModel: field('hybrid'),
        fixedAmount: field(null, 'absent'),
        revenueSharePct: field(5, 'high'),
        deliverables: [
          deliverable('Event recap video', 'VIDEOGRAPHY'),
          deliverable('3 social media reels', 'VIDEOGRAPHY'),
          deliverable('Drone footage', 'VIDEOGRAPHY'),
        ],
        compensationTerms: [
          compensationTerm('ep-3-inst-1', 'instalment', 'Instalment 1', 500, null, 'Before event', {
            sequenceIndex: 1,
          }),
          compensationTerm(
            'ep-3-inst-2',
            'instalment',
            'Instalment 2',
            500,
            null,
            '7 days after event',
            { sequenceIndex: 2 }
          ),
          compensationTerm(
            'ep-3-rev-1',
            'revenue_share',
            'Revenue share',
            null,
            5,
            '14 days after sponsor funds clear',
            { revenueBasis: 'sponsorship revenue' }
          ),
        ],
        conditionalPayments: [],
        commercialDependencies: [
          {
            id: 'ep-3-dep-1',
            description: field('Sponsor funds cleared'),
            type: field('funds_cleared'),
            blocksSettlement: field(true),
            relatedCompensationId: field('ep-3-rev-1'),
            relatedDeliverableId: field(null, 'absent'),
          },
        ],
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
        fixedAmount: field(null, 'absent'),
        revenueSharePct: field(null, 'absent'),
        deliverables: [
          deliverable('Main event poster', 'GRAPHIC_DESIGN'),
          deliverable('Instagram story templates', 'GRAPHIC_DESIGN'),
          deliverable('Ticket banner graphics', 'GRAPHIC_DESIGN'),
          deliverable('Sponsor assets', 'GRAPHIC_DESIGN'),
        ],
        compensationTerms: [
          compensationTerm(
            'ep-4-ms-1',
            'milestone',
            'Milestone 1',
            250,
            null,
            'Agreement commencement',
            { sequenceIndex: 1 }
          ),
          compensationTerm(
            'ep-4-ms-2',
            'milestone',
            'Milestone 2',
            250,
            null,
            'Final asset delivery',
            { sequenceIndex: 2, deadline: '30 July' }
          ),
        ],
        milestones: [
          {
            description: field('$250 on agreement commencement'),
            deadline: field(null, 'absent'),
            category: field('financial'),
          },
          {
            description: field('$250 on final asset delivery'),
            deadline: field('30 July'),
            category: field('financial'),
          },
        ],
        commercialDependencies: [
          {
            id: 'ep-4-dep-1',
            description: field('Final assets delivered'),
            type: field('delivery_completion'),
            blocksSettlement: field(true),
            relatedCompensationId: field('ep-4-ms-2'),
            relatedDeliverableId: field(null, 'absent'),
          },
        ],
        conditionalPayments: [],
        serviceCategories: field(['GRAPHIC_DESIGN']),
        conditions: [],
        dependencies: [],
        notes: field(null, 'absent'),
      },
      {
        id: 'ep-5',
        name: field('Ben'),
        email: field(null, 'absent'),
        role: field('Venue'),
        participationModel: field('hybrid'),
        fixedAmount: field(1200, 'high'),
        revenueSharePct: field(15, 'high'),
        deliverables: [],
        compensationTerms: [
          compensationTerm(
            'ep-5-fixed-1',
            'fixed_fee',
            'Fixed fee',
            1200,
            null,
            'Within 7 days after event'
          ),
          compensationTerm(
            'ep-5-rev-1',
            'revenue_share',
            'Revenue share',
            null,
            15,
            'Within 7 days after event',
            { revenueBasis: 'bar revenue' }
          ),
        ],
        conditionalPayments: [],
        serviceCategories: field(['VENUE']),
        milestones: [],
        conditions: [],
        dependencies: [],
        notes: field('Venue hosting and bar operations', 'medium'),
      },
    ],
    settlementRules: [
      {
        trigger: field('Within 7 days after event', 'high', 'Paid within 7 days after event'),
        basis: field('Sarah and Ben fixed and revenue share', 'medium'),
      },
      {
        trigger: field('Within 14 days after event', 'high', 'Paid within 14 days after event'),
        basis: field('Alex fixed fee and bonus', 'medium'),
      },
      {
        trigger: field('Before event', 'high', '$500 before event'),
        basis: field('Mia first instalment', 'medium'),
      },
      {
        trigger: field('14 days after sponsor funds clear', 'high'),
        basis: field('Mia sponsorship revenue share', 'medium'),
      },
    ],
    paymentTerms: [
      {
        description: field('Mia first instalment'),
        amount: field(500),
        currency: field('AUD'),
        dueCondition: field('Before event'),
      },
      {
        description: field('Mia second instalment'),
        amount: field(500),
        currency: field('AUD'),
        dueCondition: field('7 days after event'),
      },
    ],
    uncertainties: [{ field: 'currency', issue: 'Currency assumed AUD from context' }],
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
  return { ...ideal, parties, schemaVersion: 'v4' };
}

/** Legacy v4 payload without explicit compensationTerms — tests migration adapter. */
export function sunsetSessionsLegacyV4Payload(): Record<string, unknown> {
  const ideal = sunsetSessionsIdealExtractionPayload();
  const parties = (ideal.parties as Record<string, unknown>[]).map((party) => {
    const { compensationTerms: _ct, commercialDependencies: _cd, ...rest } = party;
    return rest;
  });
  return { ...ideal, parties, schemaVersion: 'v4', agreementOwner: undefined };
}
