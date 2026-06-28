import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('participant snapshot write isolation', () => {
  it('keeps project participant workflows off full snapshot persistence', () => {
    const workflowFiles = [
      'components/projects/project-participants-view.tsx',
      'components/projects/project-commercial-roles-view.tsx',
    ];

    const offenders = workflowFiles.filter((file) => {
      const text = read(file);
      return (
        text.includes('saveSnapshot(') ||
        text.includes('persistPilotSnapshot(') ||
        text.includes('persistWorkspaceFullSnapshot(') ||
        text.includes('/api/deal-network-pilot/snapshot')
      );
    });

    expect(offenders).toEqual([]);
  });

  it('does not full-sync after targeted participant workflow mutations', () => {
    const targetedRoutes = [
      'app/api/deal-network-pilot/participants/[participantId]/route.ts',
      'app/api/deal-network-pilot/participants/[participantId]/payment-request/generate/route.ts',
      'app/api/deal-network-pilot/participants/[participantId]/supplier-onboarding/route.ts',
      'app/api/deal-network-pilot/participants/[participantId]/supplier-onboarding/approve/route.ts',
      'app/api/deal-network-pilot/participants/[participantId]/supplier-onboarding/reject/route.ts',
      'app/api/deal-network-pilot/participants/[participantId]/supplier-onboarding/request-changes/route.ts',
    ];

    const offenders = targetedRoutes.filter((file) =>
      read(file).includes('syncPilotSnapshotForUser(')
    );

    expect(offenders).toEqual([]);
  });

  it('requires explicit import or replace intent for full snapshot POST', () => {
    const route = read('app/api/deal-network-pilot/snapshot/route.ts');

    expect(route).toContain("body.operation !== 'workspace_import_replace'");
  });
});
