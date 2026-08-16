import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/organization-access', () => ({
  hasOrganizationAccess: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organizations: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/treasury/reconciliation/manual-link', () => {
  const actual = jest.requireActual('@/lib/treasury/reconciliation/manual-link');
  return {
    ...actual,
    createManualTreasuryLink: jest.fn(),
  };
});

jest.mock('@/lib/treasury/reconciliation/manual-link-review', () => ({
  listManualReconciliationReviewItems: jest.fn(),
  getManualReconciliationReviewItem: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationAccess } from '@/lib/auth/organization-access';
import { prisma } from '@/lib/server/prisma';
import { createManualTreasuryLink } from '@/lib/treasury/reconciliation/manual-link';
import {
  getManualReconciliationReviewItem,
  listManualReconciliationReviewItems,
} from '@/lib/treasury/reconciliation/manual-link-review';
import { POST } from '@/app/api/treasury/manual-link/route';
import { GET } from '@/app/api/treasury/manual-link/review/route';

const ORG = '550e8400-e29b-41d4-a716-446655440000';
const USER = '660e8400-e29b-41d4-a716-446655440001';
const SOURCE = '770e8400-e29b-41d4-a716-446655440002';
const TARGET = '880e8400-e29b-41d4-a716-446655440003';

function authOk() {
  (getCurrentUserForApi as jest.Mock).mockResolvedValue({
    user: { id: USER, email: 'merchant@example.com' },
    response: null,
  });
  (prisma.organizations.findUnique as jest.Mock).mockResolvedValue({ id: ORG });
  (hasOrganizationAccess as jest.Mock).mockResolvedValue(true);
}

describe('Treasury manual-link API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authOk();
  });

  describe('GET /api/treasury/manual-link/review', () => {
    it('returns review items for manual reconciliation', async () => {
      (listManualReconciliationReviewItems as jest.Mock).mockResolvedValue([
        {
          reviewId: 'review-1',
          paymentLinkId: 'link-1',
          invoiceReference: 'INV-001',
          chainStatus: 'AWAITING_EXCHANGE_IDENTIFICATION',
          exception: {
            type: 'wallet_without_exchange',
            observed: 'Wallet transfer without matching exchange deposit',
            expected: 'Digital Surge deposit',
            reason: 'No exchange deposit correlated',
            suggestedAction: 'Sync Digital Surge',
            relatedEventIds: [SOURCE],
          },
          sourceEvent: { id: SOURCE, eventType: 'WALLET_TRANSFER', status: 'CONFIRMED' },
          candidateTargetEvents: [{ id: TARGET, eventType: 'EXCHANGE_DEPOSIT', status: 'UNKNOWN' }],
          autoLinkFailureReason: 'No exchange deposit correlated',
        },
      ]);

      const req = new NextRequest(
        `http://localhost/api/treasury/manual-link/review?organizationId=${ORG}`
      );
      const res = await GET(req);
      const body = (await res.json()) as { items: unknown[] };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
    });
  });

  describe('POST /api/treasury/manual-link', () => {
    it('requires explicit confirmLink true', async () => {
      const req = new NextRequest(`http://localhost/api/treasury/manual-link?organizationId=${ORG}`, {
        method: 'POST',
        body: JSON.stringify({
          sourceEventId: SOURCE,
          targetEventId: TARGET,
          confirmLink: false,
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('creates manual link with audit metadata', async () => {
      (createManualTreasuryLink as jest.Mock).mockResolvedValue({
        linkId: 'link-row-1',
        auditId: 'audit-1',
        manualReconciliation: {
          linkId: 'link-row-1',
          auditId: 'audit-1',
          linkedAt: '2026-08-16T10:00:00.000Z',
          linkedByUserId: USER,
          notes: 'Confirmed deposit',
          linkStatus: 'INFERRED',
          manual: true,
          sourceEventId: SOURCE,
          targetEventId: TARGET,
        },
      });

      const req = new NextRequest(`http://localhost/api/treasury/manual-link?organizationId=${ORG}`, {
        method: 'POST',
        body: JSON.stringify({
          sourceEventId: SOURCE,
          targetEventId: TARGET,
          confirmLink: true,
          notes: 'Confirmed deposit',
        }),
      });
      const res = await POST(req);
      const body = (await res.json()) as {
        success: boolean;
        manualReconciliation: { manual: boolean; linkedByUserId: string; notes: string };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.manualReconciliation.manual).toBe(true);
      expect(body.manualReconciliation.linkedByUserId).toBe(USER);
      expect(body.manualReconciliation.notes).toBe('Confirmed deposit');
      expect(createManualTreasuryLink).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedByUserId: USER,
          confirmLink: true,
          notes: 'Confirmed deposit',
        })
      );
    });

    it('rejects bank settlement manual manufacture', async () => {
      const { ManualReconciliationError: RealError } = jest.requireActual(
        '@/lib/treasury/reconciliation/manual-link'
      );
      (createManualTreasuryLink as jest.Mock).mockRejectedValue(
        new RealError(
          'Manual links cannot create or confirm bank settlement without independent bank evidence'
        )
      );

      const req = new NextRequest(`http://localhost/api/treasury/manual-link?organizationId=${ORG}`, {
        method: 'POST',
        body: JSON.stringify({
          sourceEventId: SOURCE,
          targetEventId: TARGET,
          confirmLink: true,
        }),
      });
      const res = await POST(req);
      const body = (await res.json()) as { error?: string };
      expect(res.status).toBe(400);
      expect(body.error).toMatch(/bank settlement/i);
    });
  });

  describe('GET review item by id', () => {
    it('returns a single review item', async () => {
      (getManualReconciliationReviewItem as jest.Mock).mockResolvedValue({ reviewId: 'review-1' });
      const req = new NextRequest(
        `http://localhost/api/treasury/manual-link/review?organizationId=${ORG}&reviewId=review-1`
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });
});
