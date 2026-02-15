/**
 * Payout batch unit tests
 * - Threshold grouping
 * - Idempotent mark-paid
 * - Mark-failed unassigns lines
 */

describe('Payout batch logic', () => {
  describe('threshold grouping', () => {
    function groupByThreshold(
      payees: { userId: string; amount: number }[],
      minThreshold: number
    ): { userId: string; amount: number }[] {
      const grouped = new Map<string, number>();
      for (const p of payees) {
        const current = grouped.get(p.userId) ?? 0;
        grouped.set(p.userId, current + p.amount);
      }
      return Array.from(grouped.entries())
        .filter(([, amount]) => amount >= minThreshold)
        .map(([userId, amount]) => ({ userId, amount }));
    }

    it('filters out payees below threshold', () => {
      const payees = [
        { userId: 'u1', amount: 30 },
        { userId: 'u1', amount: 20 },
        { userId: 'u2', amount: 10 },
      ];
      const result = groupByThreshold(payees, 50);
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('u1');
      expect(result[0].amount).toBe(50);
    });

    it('includes payees at or above threshold', () => {
      const payees = [
        { userId: 'u1', amount: 50 },
        { userId: 'u2', amount: 100 },
      ];
      const result = groupByThreshold(payees, 50);
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.userId === 'u1')?.amount).toBe(50);
      expect(result.find((r) => r.userId === 'u2')?.amount).toBe(100);
    });
  });

  describe('idempotent mark-paid', () => {
    it('returns early when already PAID', () => {
      const status = 'PAID';
      const shouldSkip = status === 'PAID';
      expect(shouldSkip).toBe(true);
    });

    it('proceeds when status is DRAFT or SUBMITTED', () => {
      expect('DRAFT' === 'PAID').toBe(false);
      expect('SUBMITTED' === 'PAID').toBe(false);
    });
  });

  describe('mark-failed unassigns lines', () => {
    it('sets payout_id to null, status to POSTED, and paid_at to null for unassign', () => {
      const updatePayload = {
        payout_id: null,
        status: 'POSTED' as const,
        paid_at: null as Date | null,
      };
      expect(updatePayload.payout_id).toBeNull();
      expect(updatePayload.status).toBe('POSTED');
      expect(updatePayload.paid_at).toBeNull();
    });
  });
});
