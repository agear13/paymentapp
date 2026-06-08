import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('onboarding obligation refresh wiring', () => {
  it('POST /api/onboarding/participants refreshes obligations after persist', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/api/onboarding/participants/route.ts'),
      'utf-8'
    );
    expect(source).toContain('refreshProjectObligationsAfterParticipantPersist');
    expect(source).toContain('syncPilotSnapshotForUser');
    const syncIndex = source.indexOf('syncPilotSnapshotForUser');
    const refreshIndex = source.indexOf('refreshProjectObligationsAfterParticipantPersist');
    expect(refreshIndex).toBeGreaterThan(syncIndex);
  });

  it('refresh helper matches workspace obligations/refresh pipeline', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/onboarding/refresh-onboarding-project-obligations.server.ts'),
      'utf-8'
    );
    expect(source).toContain('refreshDealNetworkPilotObligationsForDeal');
    expect(source).toContain('orchestrateOperationalMutation');
  });
});
