/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/advisor/chat/route';

jest.mock('@/lib/advisor/advisor-chat-config', () => ({
  isAdvisorChatEnabledServer: jest.fn(() => true),
}));

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(async () => ({ id: 'org-1' })),
}));

jest.mock('@/lib/advisor/load-advisor-intelligence.server', () => ({
  loadAdvisorIntelligenceContext: jest.fn(async () => ({})),
}));

jest.mock('@/lib/advisor/advisor-chat-orchestrator.server', () => ({
  runAdvisorChat: jest.fn(async () => ({
    answer: 'Wise is currently the best fit.',
    toolUsed: 'recommend_payment_rail',
    routingMode: 'deterministic',
    sessionPaymentContext: {
      origin: 'AU',
      destination: 'ID',
      amount: 100000,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      priority: 'balanced',
      transactionType: 'supplier_payment',
    },
    intent: 'best_rail_recommendation',
    paymentContext: {
      origin: 'AU',
      destination: 'ID',
      amount: 100000,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      priority: 'balanced',
      transactionType: 'supplier_payment',
    },
    parameterUsage: {
      engineUsed: ['origin', 'destination', 'amount', 'sourceCurrency', 'transactionType', 'priority', 'destinationCurrency'],
      contextualOnly: [],
      enginePriority: 'best_fit',
      requestedPriority: 'balanced',
    },
    recommendation: null,
    alternatives: [],
    reasons: [],
    tradeoffs: [],
    unknowns: [],
    explanation: null,
    scenarioComparison: null,
    monitoring: null,
    evidence: [],
    dataFreshness: {
      snapshotKind: 'catalog_static',
      catalogueUpdated: '2026',
      intelligenceSnapshotDate: '2026',
      pricingKind: 'indicative_catalogue',
      monitoringKind: 'unavailable',
      disclaimer: 'Typical route characteristics',
    },
    tool: 'recommend_payment_rail',
  })),
}));

jest.mock('@/lib/email/lifecycle/server-advisor-signal', () => ({
  recordAdvisorActivity: jest.fn(async () => {}),
}));

jest.mock('@/lib/audit/request-context.server', () => ({
  extractRequestAuditContext: jest.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'jest' })),
}));

const { getCurrentUserForApi } = jest.requireMock('@/lib/auth/api-session.server');

describe('POST /api/advisor/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    getCurrentUserForApi.mockResolvedValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const request = new NextRequest('http://localhost/api/advisor/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('accepts authenticated chat requests and returns structured intelligence', async () => {
    getCurrentUserForApi.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'demo@example.com' },
      response: null,
    });

    const request = new NextRequest('http://localhost/api/advisor/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How should I pay my Indonesian supplier A$100,000?',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.answer).toMatch(/Wise/);
    expect(payload.sessionPaymentContext.amount).toBe(100000);
    expect(payload.dataFreshness.pricingKind).toBe('indicative_catalogue');
  });
});
