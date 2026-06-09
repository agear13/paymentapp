export const LEAD_PRIORITY_BANDS = ['LOW', 'MEDIUM', 'HIGH', 'IDEAL_ICP'] as const;

export type LeadPriorityBand = (typeof LEAD_PRIORITY_BANDS)[number];

export const LEAD_RECOMMENDED_USE_CASES = [
  'Event Revenue Sharing',
  'Venue Settlement',
  'Client Fund Coordination',
  'Multi Party Settlement',
  'Obligation Management',
] as const;

export type LeadRecommendedUseCase = (typeof LEAD_RECOMMENDED_USE_CASES)[number];

export type LeadScoringSignals = {
  revenueShareDetected: boolean;
  hospitalityDetected: boolean;
  eventDetected: boolean;
  accountantDetected: boolean;
  multiPartyDetected: boolean;
  partyCount: number;
  obligationCount: number;
  riskCount: number;
  revenueSplitCount: number;
  paymentConditionCount: number;
};

export type LeadEngagementSignals = {
  reportViewed: boolean;
  emailOpened: boolean;
  emailClicked: boolean;
  demoClicked: boolean;
  demoBooked: boolean;
};

export type LeadScoreComputation = {
  signals: LeadScoringSignals;
  engagement: LeadEngagementSignals;
  settlementComplexityScore: number;
  structuralFitScore: number;
  engagementBonus: number;
  overallScore: number;
  priorityBand: LeadPriorityBand;
  recommendedUseCase: LeadRecommendedUseCase;
};

export type PersistedLeadScore = LeadScoreComputation & {
  leadId: string;
  scoreId: string;
};
