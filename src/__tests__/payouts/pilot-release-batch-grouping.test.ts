import type { PilotReleaseBatchLine } from '@/lib/operations/orchestration/pilot-release-batch.server';

/** Mirrors createPilotReleaseBatch grouping — keeps payout batch tests DB-free. */
function groupPilotLinesForBatch(
  lines: PilotReleaseBatchLine[],
  minThreshold: number
): { participantCount: number; totalAmount: number } {
  const grouped = new Map<string, number>();
  for (const line of lines) {
    grouped.set(line.participantId, (grouped.get(line.participantId) ?? 0) + line.amount);
  }
  const payees = Array.from(grouped.values()).filter((amount) => amount >= minThreshold);
  return {
    participantCount: payees.length,
    totalAmount: payees.reduce((sum, amount) => sum + amount, 0),
  };
}

describe('pilot release batch grouping (1B)', () => {
  it('groups obligations by participant and applies threshold', () => {
    const lines: PilotReleaseBatchLine[] = [
      {
        obligationId: 'o1',
        participantId: 'p1',
        participantName: 'Alex',
        amount: 40,
        currency: 'AUD',
      },
      {
        obligationId: 'o2',
        participantId: 'p1',
        participantName: 'Alex',
        amount: 20,
        currency: 'AUD',
      },
      {
        obligationId: 'o3',
        participantId: 'p2',
        participantName: 'Sam',
        amount: 30,
        currency: 'AUD',
      },
    ];

    expect(groupPilotLinesForBatch(lines, 50)).toEqual({
      participantCount: 1,
      totalAmount: 60,
    });
    expect(groupPilotLinesForBatch(lines, 0)).toEqual({
      participantCount: 2,
      totalAmount: 90,
    });
  });
});
