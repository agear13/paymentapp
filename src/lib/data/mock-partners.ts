// Mock data for Partners module (Revenue Share & Payouts)
// Used for investor/enterprise demos - no backend required

export interface Partner {
  id: string;
  name: string;
  email: string;
  role: 'Affiliate' | 'Partner' | 'Contributor';
  status: 'Active' | 'Pending' | 'Inactive';
  joinedDate: string;
  totalEarnings: number;
  pendingEarnings: number;
  paidOut: number;
  nextPayoutDate: string;
  payoutMethod: 'Bank Transfer' | 'Crypto Wallet' | 'PayPal' | 'Wire';
  revenueShareRate: number; // percentage
}

export interface AttributedEntity {
  id: string;
  partnerId: string;
  entityName: string;
  entityType: 'Merchant' | 'Program';
  attributionDate: string;
  status: 'Active' | 'Churned' | 'Pending';
  grossRevenue: number;
  earningsAllocated: number;
}

export interface LedgerEntry {
  id: string;
  partnerId: string;
  date: string;
  source: string; // Entity name
  sourceType: 'Merchant' | 'Program';
  transactionType: 'Payment Link' | 'Rewards' | 'Invoice' | 'Other';
  grossAmount: number;
  allocationRate: number; // percentage
  earningsAmount: number;
  status: 'Pending' | 'Paid' | 'Scheduled';
  payoutId?: string;
}

export interface AllocationRule {
  id: string;
  scope: string;
  allocationType: 'Percentage' | 'Fixed Amount' | 'Tiered';
  value: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo?: string;
  description: string;
}

export interface Payout {
  id: string;
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  method: 'Bank Transfer' | 'Crypto Wallet' | 'PayPal' | 'Wire';
  status: 'Scheduled' | 'Processing' | 'Completed' | 'Failed';
  scheduledDate?: string;
  completedDate?: string;
  referenceId: string;
  ledgerEntries: string[]; // IDs of included ledger entries
}

export interface EarningsDataPoint {
  date: string;
  earnings: number;
  gross: number;
}

export interface ProgramMetrics {
  totalPartners: number;
  activePartners: number;
  totalRevenue: number;
  totalAllocated: number;
  avgRevenuePerPartner: number;
}

// Current user's partner profile (for demo)
export const currentPartnerProfile: Partner = {
  id: 'partner-001',
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  role: 'Partner',
  status: 'Active',
  joinedDate: '2024-09-15',
  totalEarnings: 24567.89,
  pendingEarnings: 3890.50,
  paidOut: 20677.39,
  nextPayoutDate: '2026-02-01',
  payoutMethod: 'Bank Transfer',
  revenueShareRate: 15,
};

// Mock attributed entities
export const mockAttributedEntities: AttributedEntity[] = [
  {
    id: 'attr-001',
    partnerId: 'partner-001',
    entityName: 'TechStart Solutions',
    entityType: 'Merchant',
    attributionDate: '2024-10-12',
    status: 'Active',
    grossRevenue: 45230.00,
    earningsAllocated: 6784.50,
  },
  {
    id: 'attr-002',
    partnerId: 'partner-001',
    entityName: 'CloudBase Inc',
    entityType: 'Merchant',
    attributionDate: '2024-11-03',
    status: 'Active',
    grossRevenue: 38900.00,
    earningsAllocated: 5835.00,
  },
  {
    id: 'attr-003',
    partnerId: 'partner-001',
    entityName: 'DataFlow Systems',
    entityType: 'Merchant',
    attributionDate: '2024-12-18',
    status: 'Active',
    grossRevenue: 52100.00,
    earningsAllocated: 7815.00,
  },
  {
    id: 'attr-004',
    partnerId: 'partner-001',
    entityName: 'Retail Partners Program',
    entityType: 'Program',
    attributionDate: '2024-11-20',
    status: 'Active',
    grossRevenue: 28450.00,
    earningsAllocated: 4267.50,
  },
  {
    id: 'attr-005',
    partnerId: 'partner-001',
    entityName: 'FinServe Group',
    entityType: 'Merchant',
    attributionDate: '2024-09-30',
    status: 'Churned',
    grossRevenue: 12300.00,
    earningsAllocated: 1845.00,
  },
];

// Mock ledger entries
export const mockLedgerEntries: LedgerEntry[] = [
  {
    id: 'ledger-001',
    partnerId: 'partner-001',
    date: '2026-01-20',
    source: 'TechStart Solutions',
    sourceType: 'Merchant',
    transactionType: 'Payment Link',
    grossAmount: 1250.00,
    allocationRate: 15,
    earningsAmount: 187.50,
    status: 'Pending',
  },
  {
    id: 'ledger-002',
    partnerId: 'partner-001',
    date: '2026-01-19',
    source: 'CloudBase Inc',
    sourceType: 'Merchant',
    transactionType: 'Invoice',
    grossAmount: 2100.00,
    allocationRate: 15,
    earningsAmount: 315.00,
    status: 'Pending',
  },
  {
    id: 'ledger-003',
    partnerId: 'partner-001',
    date: '2026-01-18',
    source: 'DataFlow Systems',
    sourceType: 'Merchant',
    transactionType: 'Payment Link',
    grossAmount: 3890.00,
    allocationRate: 15,
    earningsAmount: 583.50,
    status: 'Pending',
  },
  {
    id: 'ledger-004',
    partnerId: 'partner-001',
    date: '2026-01-15',
    source: 'Retail Partners Program',
    sourceType: 'Program',
    transactionType: 'Rewards',
    grossAmount: 890.00,
    allocationRate: 15,
    earningsAmount: 133.50,
    status: 'Pending',
  },
  {
    id: 'ledger-005',
    partnerId: 'partner-001',
    date: '2026-01-10',
    source: 'TechStart Solutions',
    sourceType: 'Merchant',
    transactionType: 'Payment Link',
    grossAmount: 4500.00,
    allocationRate: 15,
    earningsAmount: 675.00,
    status: 'Paid',
    payoutId: 'payout-003',
  },
  {
    id: 'ledger-006',
    partnerId: 'partner-001',
    date: '2026-01-08',
    source: 'CloudBase Inc',
    sourceType: 'Merchant',
    transactionType: 'Invoice',
    grossAmount: 1890.00,
    allocationRate: 15,
    earningsAmount: 283.50,
    status: 'Paid',
    payoutId: 'payout-003',
  },
  {
    id: 'ledger-007',
    partnerId: 'partner-001',
    date: '2025-12-28',
    source: 'DataFlow Systems',
    sourceType: 'Merchant',
    transactionType: 'Payment Link',
    grossAmount: 6700.00,
    allocationRate: 15,
    earningsAmount: 1005.00,
    status: 'Paid',
    payoutId: 'payout-002',
  },
  {
    id: 'ledger-008',
    partnerId: 'partner-001',
    date: '2025-12-20',
    source: 'TechStart Solutions',
    sourceType: 'Merchant',
    transactionType: 'Other',
    grossAmount: 2340.00,
    allocationRate: 15,
    earningsAmount: 351.00,
    status: 'Paid',
    payoutId: 'payout-002',
  },
];

// Mock allocation rules
export const mockAllocationRules: AllocationRule[] = [
  {
    id: 'rule-001',
    scope: 'All Merchants',
    allocationType: 'Percentage',
    value: '15%',
    priority: 1,
    effectiveFrom: '2024-09-01',
    description: 'Standard revenue share for partner-attributed merchants',
  },
  {
    id: 'rule-002',
    scope: 'High-Value Merchants (>$50K/mo)',
    allocationType: 'Tiered',
    value: '12% base + 3% bonus',
    priority: 2,
    effectiveFrom: '2024-10-01',
    description: 'Reduced base rate with performance bonus for high-value accounts',
  },
  {
    id: 'rule-003',
    scope: 'Program Contributions',
    allocationType: 'Percentage',
    value: '15%',
    priority: 3,
    effectiveFrom: '2024-11-01',
    description: 'Revenue share for merchants attributed via partner programs',
  },
  {
    id: 'rule-004',
    scope: 'First 90 Days (New Merchants)',
    allocationType: 'Percentage',
    value: '20%',
    priority: 4,
    effectiveFrom: '2024-09-01',
    effectiveTo: '2025-03-31',
    description: 'Promotional boost for first quarter of new merchant relationships',
  },
];

// Mock payouts
export const mockPayouts: Payout[] = [
  {
    id: 'payout-001',
    partnerId: 'partner-001',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-15',
    amount: 3890.50,
    method: 'Bank Transfer',
    status: 'Scheduled',
    scheduledDate: '2026-02-16',
    referenceId: 'PAY-2026-02-001',
    ledgerEntries: ['ledger-001', 'ledger-002', 'ledger-003', 'ledger-004'],
  },
  {
    id: 'payout-002',
    partnerId: 'partner-001',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-15',
    amount: 1356.00,
    method: 'Bank Transfer',
    status: 'Completed',
    scheduledDate: '2026-01-16',
    completedDate: '2026-01-16',
    referenceId: 'PAY-2026-01-002',
    ledgerEntries: ['ledger-007', 'ledger-008'],
  },
  {
    id: 'payout-003',
    partnerId: 'partner-001',
    periodStart: '2025-12-16',
    periodEnd: '2025-12-31',
    amount: 958.50,
    method: 'Bank Transfer',
    status: 'Completed',
    scheduledDate: '2026-01-02',
    completedDate: '2026-01-03',
    referenceId: 'PAY-2025-12-003',
    ledgerEntries: ['ledger-005', 'ledger-006'],
  },
  {
    id: 'payout-004',
    partnerId: 'partner-001',
    periodStart: '2025-12-01',
    periodEnd: '2025-12-15',
    amount: 2145.75,
    method: 'Bank Transfer',
    status: 'Completed',
    scheduledDate: '2025-12-16',
    completedDate: '2025-12-17',
    referenceId: 'PAY-2025-12-001',
    ledgerEntries: [],
  },
  {
    id: 'payout-005',
    partnerId: 'partner-001',
    periodStart: '2025-11-16',
    periodEnd: '2025-11-30',
    amount: 1890.30,
    method: 'Bank Transfer',
    status: 'Completed',
    scheduledDate: '2025-12-01',
    completedDate: '2025-12-02',
    referenceId: 'PAY-2025-11-002',
    ledgerEntries: [],
  },
];

// Mock earnings chart data (last 30 days)
export const mockEarningsChartData: EarningsDataPoint[] = [
  { date: '2025-12-22', earnings: 245.50, gross: 1637 },
  { date: '2025-12-23', earnings: 189.75, gross: 1265 },
  { date: '2025-12-24', earnings: 0, gross: 0 },
  { date: '2025-12-25', earnings: 0, gross: 0 },
  { date: '2025-12-26', earnings: 312.00, gross: 2080 },
  { date: '2025-12-27', earnings: 456.25, gross: 3042 },
  { date: '2025-12-28', earnings: 1005.00, gross: 6700 },
  { date: '2025-12-29', earnings: 234.00, gross: 1560 },
  { date: '2025-12-30', earnings: 298.50, gross: 1990 },
  { date: '2025-12-31', earnings: 187.25, gross: 1248 },
  { date: '2026-01-01', earnings: 0, gross: 0 },
  { date: '2026-01-02', earnings: 423.75, gross: 2825 },
  { date: '2026-01-03', earnings: 356.50, gross: 2377 },
  { date: '2026-01-04', earnings: 289.00, gross: 1927 },
  { date: '2026-01-05', earnings: 512.25, gross: 3415 },
  { date: '2026-01-06', earnings: 445.00, gross: 2967 },
  { date: '2026-01-07', earnings: 378.50, gross: 2523 },
  { date: '2026-01-08', earnings: 283.50, gross: 1890 },
  { date: '2026-01-09', earnings: 401.25, gross: 2675 },
  { date: '2026-01-10', earnings: 675.00, gross: 4500 },
  { date: '2026-01-11', earnings: 298.75, gross: 1992 },
  { date: '2026-01-12', earnings: 0, gross: 0 },
  { date: '2026-01-13', earnings: 534.00, gross: 3560 },
  { date: '2026-01-14', earnings: 412.50, gross: 2750 },
  { date: '2026-01-15', earnings: 133.50, gross: 890 },
  { date: '2026-01-16', earnings: 267.75, gross: 1785 },
  { date: '2026-01-17', earnings: 489.25, gross: 3262 },
  { date: '2026-01-18', earnings: 583.50, gross: 3890 },
  { date: '2026-01-19', earnings: 315.00, gross: 2100 },
  { date: '2026-01-20', earnings: 187.50, gross: 1250 },
];

// Mock program metrics
export const mockProgramMetrics: ProgramMetrics = {
  totalPartners: 47,
  activePartners: 42,
  totalRevenue: 2847392.50,
  totalAllocated: 427108.88,
  avgRevenuePerPartner: 60582.80,
};

// All partners for program overview
export const mockAllPartners: Partner[] = [
  currentPartnerProfile,
  {
    id: 'partner-002',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    role: 'Affiliate',
    status: 'Active',
    joinedDate: '2024-08-22',
    totalEarnings: 18934.25,
    pendingEarnings: 2340.75,
    paidOut: 16593.50,
    nextPayoutDate: '2026-02-01',
    payoutMethod: 'Crypto Wallet',
    revenueShareRate: 12,
  },
  {
    id: 'partner-003',
    name: 'Marcus Johnson',
    email: 'marcus.j@example.com',
    role: 'Partner',
    status: 'Active',
    joinedDate: '2024-07-10',
    totalEarnings: 31205.80,
    pendingEarnings: 4120.00,
    paidOut: 27085.80,
    nextPayoutDate: '2026-02-01',
    payoutMethod: 'Bank Transfer',
    revenueShareRate: 15,
  },
  {
    id: 'partner-004',
    name: 'Emma Rodriguez',
    email: 'e.rodriguez@example.com',
    role: 'Contributor',
    status: 'Active',
    joinedDate: '2024-10-05',
    totalEarnings: 8456.50,
    pendingEarnings: 1205.25,
    paidOut: 7251.25,
    nextPayoutDate: '2026-02-01',
    payoutMethod: 'PayPal',
    revenueShareRate: 10,
  },
  {
    id: 'partner-005',
    name: 'James Park',
    email: 'james.park@example.com',
    role: 'Partner',
    status: 'Pending',
    joinedDate: '2026-01-15',
    totalEarnings: 0,
    pendingEarnings: 0,
    paidOut: 0,
    nextPayoutDate: '2026-02-01',
    payoutMethod: 'Bank Transfer',
    revenueShareRate: 15,
  },
];

