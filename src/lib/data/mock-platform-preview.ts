// Mock data for Platform Preview Module
// UI-only conceptual preview - no backend integration

export interface OverviewMetrics {
  grossSales: number;
  netReceipts: number;
  pendingSettlements: number;
  feesPaid: number;
  inventoryRiskCount: number;
  openOrders: number;
  lastSyncTimestamp: string;
}

export interface ChannelBreakdown {
  channel: string;
  gross: number;
  net: number;
  fees: number;
  orderCount: number;
}

export interface AttentionItem {
  id: string;
  type: 'warning' | 'info' | 'error';
  title: string;
  description: string;
  actionLabel?: string;
}

export interface Connection {
  id: string;
  name: string;
  category: 'POS' | 'Marketplace' | 'Payments' | 'Accounting' | 'Platform';
  status: 'Connected' | 'Needs Attention' | 'Off' | 'Coming Soon';
  lastSync?: string;
  dataFeedsEnabled: string[];
  helperText: string;
}

export interface InventorySku {
  skuId: string;
  skuName: string;
  estimatedOnHand: number;
  velocityPerDay: number;
  daysOfCover: number;
  status: 'OK' | 'Low' | 'Drift';
  reorderSuggestion: string;
}

export interface SkuTimelineEvent {
  timestamp: string;
  eventType: 'Sale Burn' | 'Delivery' | 'Waste' | 'Adjustment' | 'Stocktake';
  qtyDelta: number;
  note: string;
}

export interface UnifiedLedgerRow {
  id: string;
  timestamp: string;
  eventType: 'Payment Received' | 'Payout Settled' | 'Refund' | 'Fee' | 'Inventory Adjustment';
  sourceSystem: 'POS' | 'Grab' | 'Stripe' | 'Xero' | 'Provvypay';
  referenceId: string;
  amount?: number;
  currency: string;
  relatedEntity: string;
}

export interface SalesChartDataPoint {
  date: string;
  gross: number;
  net: number;
}

// Overview Metrics
export const overviewMetrics: OverviewMetrics = {
  grossSales: 487250.00,
  netReceipts: 462180.50,
  pendingSettlements: 18450.00,
  feesPaid: 6619.50,
  inventoryRiskCount: 7,
  openOrders: 34,
  lastSyncTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
};

// Channel Breakdown
export const channelBreakdown: ChannelBreakdown[] = [
  {
    channel: 'POS (In-store)',
    gross: 285400.00,
    net: 275230.00,
    fees: 2850.00,
    orderCount: 1247,
  },
  {
    channel: 'Grab',
    gross: 124850.00,
    net: 119127.50,
    fees: 3120.50,
    orderCount: 589,
  },
  {
    channel: 'Online (Stripe / App)',
    gross: 68300.00,
    net: 67123.00,
    fees: 649.00,
    orderCount: 312,
  },
  {
    channel: 'Invoices',
    gross: 8700.00,
    net: 8700.00,
    fees: 0,
    orderCount: 18,
  },
];

// Attention Items
export const attentionItems: AttentionItem[] = [
  {
    id: 'att-1',
    type: 'warning',
    title: 'Low Stock Alert',
    description: 'Milk 2L projected low in 1.3 days based on current velocity',
    actionLabel: 'View Inventory',
  },
  {
    id: 'att-2',
    type: 'error',
    title: 'Inventory Drift Detected',
    description: 'Drift detected on 4 SKUs - stocktake recommended',
    actionLabel: 'Review Items',
  },
  {
    id: 'att-3',
    type: 'warning',
    title: 'Payout Delays',
    description: '2 payouts delayed due to bank verification',
    actionLabel: 'Check Payouts',
  },
  {
    id: 'att-4',
    type: 'info',
    title: 'Fee Anomaly',
    description: 'Grab fees unusually high this week (+12% vs avg)',
    actionLabel: 'View Breakdown',
  },
];

// Connections
export const connections: Connection[] = [
  {
    id: 'conn-pos',
    name: 'POS (In-store)',
    category: 'POS',
    status: 'Connected',
    lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    dataFeedsEnabled: ['Orders', 'Payments', 'Inventory'],
    helperText: 'Real-time sync of in-store transactions and stock movements',
  },
  {
    id: 'conn-grab',
    name: 'Grab',
    category: 'Marketplace',
    status: 'Connected',
    lastSync: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    dataFeedsEnabled: ['Orders', 'Fees', 'Payouts'],
    helperText: 'Ingests Grab orders, marketplace fees, and settlement data',
  },
  {
    id: 'conn-stripe',
    name: 'Stripe / Online',
    category: 'Payments',
    status: 'Connected',
    lastSync: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    dataFeedsEnabled: ['Payments', 'Fees', 'Payouts'],
    helperText: 'Online payment processing and settlement reconciliation',
  },
  {
    id: 'conn-xero',
    name: 'Xero',
    category: 'Accounting',
    status: 'Needs Attention',
    lastSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dataFeedsEnabled: ['Invoices', 'Payments'],
    helperText: 'Accounting integration for invoice and payment reconciliation',
  },
  {
    id: 'conn-partners',
    name: 'Partners / Revenue Share',
    category: 'Platform',
    status: 'Connected',
    lastSync: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    dataFeedsEnabled: ['Payouts'],
    helperText: 'Tracks partner allocations and revenue share distributions',
  },
  {
    id: 'conn-shopify',
    name: 'Shopify',
    category: 'POS',
    status: 'Coming Soon',
    dataFeedsEnabled: [],
    helperText: 'E-commerce platform integration for unified inventory and orders',
  },
];

// Inventory SKUs
export const inventorySkus: InventorySku[] = [
  {
    skuId: 'sku-milk-2l',
    skuName: 'Milk 2L',
    estimatedOnHand: 48,
    velocityPerDay: 36.5,
    daysOfCover: 1.3,
    status: 'Low',
    reorderSuggestion: 'Order 200 units (5.5 days cover)',
  },
  {
    skuId: 'sku-bread-white',
    skuName: 'White Bread',
    estimatedOnHand: 120,
    velocityPerDay: 28.2,
    daysOfCover: 4.3,
    status: 'OK',
    reorderSuggestion: 'Monitor - reorder in 2 days',
  },
  {
    skuId: 'sku-eggs-dozen',
    skuName: 'Eggs (Dozen)',
    estimatedOnHand: 89,
    velocityPerDay: 24.1,
    daysOfCover: 3.7,
    status: 'OK',
    reorderSuggestion: 'Adequate stock',
  },
  {
    skuId: 'sku-coffee-250g',
    skuName: 'Coffee Beans 250g',
    estimatedOnHand: 34,
    velocityPerDay: 8.5,
    daysOfCover: 4.0,
    status: 'Drift',
    reorderSuggestion: 'Stocktake recommended - drift detected',
  },
  {
    skuId: 'sku-rice-5kg',
    skuName: 'Rice 5kg',
    estimatedOnHand: 156,
    velocityPerDay: 12.3,
    daysOfCover: 12.7,
    status: 'OK',
    reorderSuggestion: 'Adequate stock',
  },
  {
    skuId: 'sku-oil-1l',
    skuName: 'Cooking Oil 1L',
    estimatedOnHand: 67,
    velocityPerDay: 15.8,
    daysOfCover: 4.2,
    status: 'OK',
    reorderSuggestion: 'Monitor',
  },
  {
    skuId: 'sku-sugar-1kg',
    skuName: 'Sugar 1kg',
    estimatedOnHand: 22,
    velocityPerDay: 9.1,
    daysOfCover: 2.4,
    status: 'Low',
    reorderSuggestion: 'Order 80 units (8.8 days cover)',
  },
  {
    skuId: 'sku-pasta-500g',
    skuName: 'Pasta 500g',
    estimatedOnHand: 142,
    velocityPerDay: 18.5,
    daysOfCover: 7.7,
    status: 'OK',
    reorderSuggestion: 'Adequate stock',
  },
];

// SKU Timeline Events (by SKU ID)
export const skuTimelineEvents: Record<string, SkuTimelineEvent[]> = {
  'sku-milk-2l': [
    {
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      eventType: 'Sale Burn',
      qtyDelta: -12,
      note: 'POS sales (in-store)',
    },
    {
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      eventType: 'Sale Burn',
      qtyDelta: -8,
      note: 'Grab orders',
    },
    {
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      eventType: 'Sale Burn',
      qtyDelta: -16,
      note: 'POS sales (in-store)',
    },
    {
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      eventType: 'Delivery',
      qtyDelta: 100,
      note: 'Supplier delivery - Fresh Dairy Co',
    },
    {
      timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      eventType: 'Waste',
      qtyDelta: -6,
      note: 'Expired stock removal',
    },
  ],
  'sku-coffee-250g': [
    {
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      eventType: 'Sale Burn',
      qtyDelta: -3,
      note: 'Online orders',
    },
    {
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      eventType: 'Stocktake',
      qtyDelta: -8,
      note: 'Stocktake correction - drift detected',
    },
    {
      timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      eventType: 'Delivery',
      qtyDelta: 50,
      note: 'Supplier delivery - Coffee Wholesale',
    },
  ],
  'sku-sugar-1kg': [
    {
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      eventType: 'Sale Burn',
      qtyDelta: -5,
      note: 'POS sales',
    },
    {
      timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      eventType: 'Sale Burn',
      qtyDelta: -4,
      note: 'Grab orders',
    },
    {
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      eventType: 'Delivery',
      qtyDelta: 60,
      note: 'Supplier delivery - Bulk Foods',
    },
  ],
};

// Sales Chart Data (Last 30 days)
export const salesChartData: SalesChartDataPoint[] = [
  { date: '2025-12-22', gross: 14250, net: 13587 },
  { date: '2025-12-23', gross: 15100, net: 14395 },
  { date: '2025-12-24', gross: 18900, net: 18011 },
  { date: '2025-12-25', gross: 12300, net: 11724 },
  { date: '2025-12-26', gross: 16780, net: 15982 },
  { date: '2025-12-27', gross: 15450, net: 14727 },
  { date: '2025-12-28', gross: 14890, net: 14195 },
  { date: '2025-12-29', gross: 16200, net: 15430 },
  { date: '2025-12-30', gross: 17500, net: 16675 },
  { date: '2025-12-31', gross: 19800, net: 18861 },
  { date: '2026-01-01', gross: 13200, net: 12584 },
  { date: '2026-01-02', gross: 15800, net: 15062 },
  { date: '2026-01-03', gross: 16100, net: 15335 },
  { date: '2026-01-04', gross: 14900, net: 14205 },
  { date: '2026-01-05', gross: 15600, net: 14868 },
  { date: '2026-01-06', gross: 17200, net: 16386 },
  { date: '2026-01-07', gross: 16800, net: 16004 },
  { date: '2026-01-08', gross: 15900, net: 15153 },
  { date: '2026-01-09', gross: 16500, net: 15725 },
  { date: '2026-01-10', gross: 17800, net: 16961 },
  { date: '2026-01-11', gross: 14500, net: 13825 },
  { date: '2026-01-12', gross: 15200, net: 14494 },
  { date: '2026-01-13', gross: 16700, net: 15915 },
  { date: '2026-01-14', gross: 17100, net: 16295 },
  { date: '2026-01-15', gross: 15800, net: 15062 },
  { date: '2026-01-16', gross: 16300, net: 15535 },
  { date: '2026-01-17', gross: 17500, net: 16675 },
  { date: '2026-01-18', gross: 16900, net: 16103 },
  { date: '2026-01-19', gross: 17200, net: 16386 },
  { date: '2026-01-20', gross: 18100, net: 17245 },
];

// Unified Ledger Rows
export const unifiedLedgerRows: UnifiedLedgerRow[] = [
  {
    id: 'ledger-1',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    eventType: 'Payment Received',
    sourceSystem: 'Stripe',
    referenceId: 'pi_3Abc123xyz',
    amount: 248.50,
    currency: 'USD',
    relatedEntity: 'Order #10234',
  },
  {
    id: 'ledger-2',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    eventType: 'Fee',
    sourceSystem: 'Grab',
    referenceId: 'fee_grab_20260121_001',
    amount: -28.45,
    currency: 'USD',
    relatedEntity: 'Settlement batch #4821',
  },
  {
    id: 'ledger-3',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    eventType: 'Payment Received',
    sourceSystem: 'POS',
    referenceId: 'pos_sale_78234',
    amount: 156.75,
    currency: 'USD',
    relatedEntity: 'Order #10233',
  },
  {
    id: 'ledger-4',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    eventType: 'Payout Settled',
    sourceSystem: 'Provvypay',
    referenceId: 'payout_20260120_partner_001',
    amount: -450.00,
    currency: 'USD',
    relatedEntity: 'Partner: Acme Referrals',
  },
  {
    id: 'ledger-5',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    eventType: 'Payment Received',
    sourceSystem: 'Grab',
    referenceId: 'grab_order_82745',
    amount: 89.20,
    currency: 'USD',
    relatedEntity: 'Order #10232',
  },
  {
    id: 'ledger-6',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    eventType: 'Inventory Adjustment',
    sourceSystem: 'POS',
    referenceId: 'adj_stocktake_001',
    currency: 'USD',
    relatedEntity: 'SKU: Coffee Beans 250g',
  },
  {
    id: 'ledger-7',
    timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    eventType: 'Refund',
    sourceSystem: 'Stripe',
    referenceId: 'refund_3Xyz789abc',
    amount: -42.00,
    currency: 'USD',
    relatedEntity: 'Order #10228',
  },
  {
    id: 'ledger-8',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    eventType: 'Payment Received',
    sourceSystem: 'Xero',
    referenceId: 'inv_2026_0234',
    amount: 1250.00,
    currency: 'USD',
    relatedEntity: 'Invoice #INV-0234',
  },
  {
    id: 'ledger-9',
    timestamp: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    eventType: 'Fee',
    sourceSystem: 'Stripe',
    referenceId: 'fee_stripe_batch_001',
    amount: -18.90,
    currency: 'USD',
    relatedEntity: 'Settlement batch #4820',
  },
  {
    id: 'ledger-10',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    eventType: 'Payment Received',
    sourceSystem: 'POS',
    referenceId: 'pos_sale_78201',
    amount: 327.80,
    currency: 'USD',
    relatedEntity: 'Order #10225',
  },
];

