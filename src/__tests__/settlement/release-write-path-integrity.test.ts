import { readFileSync } from 'fs';
import path from 'path';

function readSrc(relativePath: string): string {
  return readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

describe('release write-path integrity', () => {
  it('does not mark obligations PAID when a release is created', () => {
    const create = readSrc('app/api/payout-batches/create/route.ts');
    expect(create).not.toContain('markScopedPilotParticipantsPaid');
  });

  it('does not mark obligations PAID when a release is submitted', () => {
    const submit = readSrc('app/api/payout-batches/[id]/submit/route.ts');
    expect(submit).not.toContain('markScopedPilotParticipantsPaid');
    expect(submit).not.toMatch(/status:\s*['"]PAID['"]/);
  });

  it('does not persist PENDING_APPROVAL or PAID when creating a pilot release batch', () => {
    const batch = readSrc('lib/operations/orchestration/pilot-release-batch.server.ts');
    expect(batch).not.toContain('DealNetworkPilotObligationStatus.PENDING_APPROVAL');
    expect(batch).not.toContain('DealNetworkPilotObligationStatus.PAID');
    expect(batch).not.toMatch(/data:\s*\{\s*status:\s*DealNetworkPilotObligationStatus/);
  });

  it('cancels draft releases by deleting the batch and refuses submitted or paid payouts', () => {
    const route = readSrc('app/api/payout-batches/[id]/route.ts');
    expect(route).toContain('export async function DELETE');
    expect(route).toContain('canCancelDraftReleaseBatch');
    expect(route).toContain('payout_batches.delete');
    expect(route).toContain('Only a draft release can be cancelled.');
    expect(route).toContain('Submitted or paid payouts cannot be cancelled.');
    expect(route).not.toContain('status: \'CANCELLED\'');
    expect(route).not.toContain('status: "CANCELLED"');
  });
});
