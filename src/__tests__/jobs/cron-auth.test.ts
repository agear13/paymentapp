import { NextRequest } from 'next/server';
import {
  cronAuthFailureResponse,
  getCronSecret,
  verifyCronRequest,
} from '@/lib/jobs/cron-request-auth';

describe('cron-request-auth (B3)', () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('returns not_configured when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    const request = new NextRequest('http://localhost/api/jobs/expired-links', {
      method: 'POST',
      headers: { 'x-cron-secret': 'any' },
    });
    expect(verifyCronRequest(request)).toEqual({ kind: 'not_configured' });
    const response = cronAuthFailureResponse({ kind: 'not_configured' });
    expect(response.status).toBe(503);
  });

  it('rejects missing or wrong secret', () => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
    const request = new NextRequest('http://localhost/api/jobs/expired-links', {
      method: 'POST',
    });
    expect(verifyCronRequest(request)).toEqual({ kind: 'unauthorized' });

    const bad = new NextRequest('http://localhost/api/jobs/expired-links', {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong' },
    });
    expect(verifyCronRequest(bad)).toEqual({ kind: 'unauthorized' });
    expect(cronAuthFailureResponse({ kind: 'unauthorized' }).status).toBe(401);
  });

  it('accepts X-Cron-Secret header', () => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
    const request = new NextRequest('http://localhost/api/jobs/expired-links', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret-value' },
    });
    expect(verifyCronRequest(request)).toBeNull();
  });

  it('accepts Authorization Bearer', () => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
    const request = new NextRequest('http://localhost/api/xero/queue/process', {
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret-value' },
    });
    expect(verifyCronRequest(request)).toBeNull();
  });

  it('getCronSecret trims whitespace', () => {
    process.env.CRON_SECRET = '  secret-with-space  ';
    expect(getCronSecret()).toBe('secret-with-space');
  });
});
