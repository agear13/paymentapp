import { readFileSync } from 'fs';
import path from 'path';
import { referralParticipantSettlementHref } from '@/lib/journey/commercial-os-routes';

function readWorkspaceSrc(relativePath: string): string {
  return readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

describe('Referral Management participant settlement handoff', () => {
  it('scopes Settlement Overview to the referral participant', () => {
    expect(referralParticipantSettlementHref('participant-123')).toBe(
      '/workspace/settlement?source=referral-management&participant=participant-123'
    );
  });

  it('renders View in Settlement from the participant management screen', () => {
    const hub = readWorkspaceSrc(
      'components/journey/lovable/referral-management-hub-screen.tsx'
    );
    expect(hub).toContain('View in Settlement');
    expect(hub).toContain('referralParticipantSettlementHref');
    expect(hub).not.toContain('View in Revenue Sharing');
    expect(hub).not.toContain('/dashboard/payouts');
    expect(hub).not.toContain('PAYOUTS_OBLIGATIONS_HREF');
  });

  it('does not expose a Revenue Sharing preview handoff from Referral Management', () => {
    const hubServer = readWorkspaceSrc('lib/workflows/referral-management/hub.server.ts');
    expect(hubServer).not.toContain('revenueSharingPreviewUrl');
    expect(hubServer).not.toContain('PAYOUTS_OBLIGATIONS_HREF');
    expect(hubServer).not.toContain('/dashboard/payouts');
    expect(hubServer).toContain("settlementOverviewHref({ source: 'referral-management' })");
  });
});

describe('workspace surfaces do not hand operators to legacy payouts', () => {
  const files = [
    'components/journey/lovable/referral-management-hub-screen.tsx',
    'components/journey/lovable/agreement-intelligence-participant-detail.tsx',
    'components/journey/lovable/workspace-layout.tsx',
    'components/journey/lovable/workspace-settlement-screen.tsx',
    'lib/workflows/referral-management/hub.server.ts',
    'lib/journey/commercial-os-routes.ts',
    'lib/journey/workflow-library-catalog.ts',
  ];

  it.each(files)('keeps %s inside /workspace', (relativePath) => {
    const source = readWorkspaceSrc(relativePath);
    expect(source).not.toContain('/dashboard/payouts');
    expect(source).not.toContain('View in Revenue Sharing');
  });
});
