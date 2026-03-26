/**
 * Mock data for Deal Network / Community Deals demo (Revenue Share App).
 * UI-only demo for investor/partner conversations. Replace with real API when ready.
 */

export type DealStatus =
  | 'Pending'
  | 'Eligible'
  | 'Approved'
  | 'Paid'
  | 'Reversed'
  | 'In Review';

export interface DealSummary {
  totalDealsGenerated: number;
  contractsSigned: number;
  commissionsPending: number;
  commissionsPaid: number;
  referralRevenueGenerated: number;
  activePartners: number;
  openDeals: number;
  avgCommissionRate: number;
}

export interface CommissionSplit {
  role: string;
  name: string;
  amount: number;
}

export interface FeaturedDeal {
  id: string;
  name: string;
  dealValue: number;
  status: DealStatus;
  introducer: string;
  closer: string;
  partner: string;
  payoutTrigger: string;
  commissionSplits: CommissionSplit[];
}

export interface RecentDeal {
  id: string;
  dealName: string;
  partner: string;
  value: number;
  introducer: string;
  closer: string;
  /** Explicit commission allocations. No implicit split assumptions. */
  introducerAmount?: number;
  closerAmount?: number;
  platformFee?: number;
  /** Optional agreement context for the Introducer role (pilot-only). */
  introducerRoleDetails?: string;
  introducerPayoutCondition?: string;
  introducerAgreementNotes?: string;
  introducerAttachmentUrl?: string;
  introducerAttachmentLabel?: string;
  /** Optional agreement context for the Closer role (pilot-only). */
  closerRoleDetails?: string;
  closerPayoutCondition?: string;
  closerAgreementNotes?: string;
  closerAttachmentUrl?: string;
  closerAttachmentLabel?: string;
  status: DealStatus;
  lastUpdated: string;
  /** Set when created from the demo “Create deal” flow */
  payoutTrigger?: string;
  /** Optional payment tracking for pilot visibility only. */
  paymentLink?: string;
  paymentStatus: 'Not Paid' | 'Paid';
  paidAmount?: number;
  paidAt?: string;
  /** Rabbit Hole identity graph (demo): selected contact id */
  rhContactId?: string;
  /** e.g. Bob — BD Lead — CertiK */
  rhContactLine?: string;
  /** Graph-recorded introducer for the selected contact (audit / override messaging) */
  rhGraphIntroducer?: string;
}

export interface FunnelStage {
  label: string;
  count: number;
}

export interface AttributionRole {
  role: string;
  sharePct: number;
  description: string;
}

export interface TopEarner {
  name: string;
  amount: number;
  type: 'paid' | 'pending';
}

export interface PayoutRail {
  method: string;
  count: number;
  lastUsed: string;
}

export const dealNetworkSummary: DealSummary = {
  totalDealsGenerated: 3_200_000,
  contractsSigned: 18,
  commissionsPending: 210_000,
  commissionsPaid: 1_100_000,
  referralRevenueGenerated: 620_000,
  activePartners: 47,
  openDeals: 18,
  avgCommissionRate: 12.4,
};

export const featuredDeal: FeaturedDeal = {
  id: 'deal-certik-001',
  name: 'CertiK Security Audit',
  dealValue: 100_000,
  status: 'Pending',
  introducer: 'Alice',
  closer: 'Charlie',
  partner: 'CertiK',
  payoutTrigger: 'Contract Paid',
  commissionSplits: [
    { role: 'Introducer', name: 'Alice', amount: 10_000 },
    { role: 'Closer', name: 'Charlie', amount: 5_000 },
    { role: 'Rabbit Hole / Platform', name: 'Platform', amount: 5_000 },
  ],
};

export const recentDeals: RecentDeal[] = [
  {
    id: '1',
    dealName: 'CertiK Security Audit',
    partner: 'CertiK',
    value: 100_000,
    introducer: 'Alice',
    closer: 'Charlie',
    introducerAmount: 10_000,
    closerAmount: 5_000,
    platformFee: 5_000,
    status: 'Pending',
    lastUpdated: '2026-03-07T14:00:00Z',
    paymentStatus: 'Not Paid',
  },
  {
    id: '2',
    dealName: 'Wintermute Liquidity Setup',
    partner: 'Wintermute',
    value: 250_000,
    introducer: 'Ben',
    closer: 'Charlie',
    introducerAmount: 15_625,
    closerAmount: 7_812,
    platformFee: 7_813,
    status: 'Eligible',
    lastUpdated: '2026-03-06T11:30:00Z',
    paymentStatus: 'Not Paid',
  },
  {
    id: '3',
    dealName: 'Chainalysis Compliance Package',
    partner: 'Chainalysis',
    value: 180_000,
    introducer: 'Alice',
    closer: 'Alice',
    introducerAmount: 10_800,
    closerAmount: 5_400,
    platformFee: 5_400,
    status: 'Paid',
    lastUpdated: '2026-03-05T09:00:00Z',
    paymentStatus: 'Paid',
    paidAmount: 180_000,
    paidAt: '2026-03-05T08:30:00Z',
  },
  {
    id: '4',
    dealName: 'Dverse Listing Retainer',
    partner: 'Dverse',
    value: 75_000,
    introducer: 'Charlie',
    closer: 'Ben',
    introducerAmount: 4_500,
    closerAmount: 2_250,
    platformFee: 2_250,
    status: 'In Review',
    lastUpdated: '2026-03-04T16:45:00Z',
    paymentStatus: 'Not Paid',
  },
  {
    id: '5',
    dealName: 'Growth Agency Retainer',
    partner: 'Growth Agency',
    value: 45_000,
    introducer: 'Alice',
    closer: 'Charlie',
    introducerAmount: 2_700,
    closerAmount: 1_350,
    platformFee: 1_350,
    status: 'Paid',
    lastUpdated: '2026-03-03T10:00:00Z',
    paymentStatus: 'Paid',
    paidAmount: 45_000,
    paidAt: '2026-03-03T09:45:00Z',
  },
];

export const commissionFunnelStages: FunnelStage[] = [
  { label: 'Pending', count: 12 },
  { label: 'Eligible', count: 8 },
  { label: 'Approved', count: 5 },
  { label: 'Paid', count: 34 },
];

export const attributionBreakdown: AttributionRole[] = [
  { role: 'Introducer', sharePct: 40, description: 'First touch, deal sourced' },
  { role: 'Connector', sharePct: 15, description: 'Warm intro or referral' },
  { role: 'Closer', sharePct: 35, description: 'Negotiation & contract' },
  { role: 'Platform', sharePct: 10, description: 'Rabbit Hole / ops' },
];

export const topEarners: TopEarner[] = [
  { name: 'Alice', amount: 42_000, type: 'paid' },
  { name: 'Charlie', amount: 31_000, type: 'pending' },
  { name: 'Ben', amount: 18_000, type: 'paid' },
];

export const payoutRails: PayoutRail[] = [
  { method: 'Bank Transfer', count: 28, lastUsed: '2026-03-07' },
  { method: 'USDC', count: 12, lastUsed: '2026-03-06' },
  { method: 'Wallet', count: 5, lastUsed: '2026-03-05' },
  { method: 'Stripe Payout', count: 2, lastUsed: '2026-03-04' },
];
