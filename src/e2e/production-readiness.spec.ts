import { expect, test } from '@playwright/test';

const foreignOrgId = '00000000-0000-0000-0000-000000000001';

test.describe('Permission enforcement (unauthenticated)', () => {
  test('reports export requires authentication', async ({ request }) => {
    const response = await request.get(
      `/api/reports/export?organizationId=${foreignOrgId}`
    );
    expect(response.status()).toBe(401);
  });

  test('reports reconciliation requires authentication', async ({ request }) => {
    const response = await request.get(
      `/api/reports/reconciliation?organizationId=${foreignOrgId}`
    );
    expect(response.status()).toBe(401);
  });

  test('reports export download requires authentication', async ({ request }) => {
    const response = await request.get(
      `/api/reports/export/download?organizationId=${foreignOrgId}&type=payments`
    );
    expect(response.status()).toBe(401);
  });

  test('payment link creation requires authentication', async ({ request }) => {
    const response = await request.post('/api/payment-links', {
      data: {
        organizationId: foreignOrgId,
        amount: 10,
        currency: 'USD',
        description: 'E2E guard',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('referral payment-completed requires internal token', async ({ request }) => {
    const response = await request.post('/api/referrals/payment-completed', {
      data: {
        programSlug: 'consultant-referral',
        grossAmount: 100,
        externalRef: 'e2e-unauthorized',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('stripe webhook replay requires internal token', async ({ request }) => {
    const response = await request.post('/api/internal/webhooks/stripe/replay', {
      data: { provider_event_id: 'evt_e2e_unauthorized' },
    });
    expect(response.status()).toBe(401);
  });

  test('referral advocate create requires authentication', async ({ request }) => {
    const response = await request.post('/api/referrals/advocates/create', {
      data: {
        programSlug: 'consultant-referral',
        name: 'E2E Advocate',
        email: 'advocate@example.com',
        advocatePercent: 10,
        serviceLabel: 'E2E',
      },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Public payment surfaces', () => {
  test('invalid checkout shortcode returns safe fallback UI', async ({ page }) => {
    await page.goto('/pay/INVALID01', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('body')).toContainText(/not found|unable|invalid|expired/i);
  });

  test('public pay API rejects invalid short code format', async ({ request }) => {
    const response = await request.get('/api/public/pay/not-valid');
    expect(response.status()).toBe(400);
  });

  test('health endpoint returns healthy (shallow)', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks?.database).toBe('skipped');
  });
});
