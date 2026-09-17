import fs from 'fs';
import path from 'path';

const INCENTIVE_DIR = [
  path.join(process.cwd(), 'lib/commercial-incentive'),
  path.join(process.cwd(), 'src/lib/commercial-incentive'),
].find((dir) => fs.existsSync(dir));

if (!INCENTIVE_DIR) {
  throw new Error('Could not find src/lib/commercial-incentive');
}

function readSources(): string {
  return fs
    .readdirSync(INCENTIVE_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(INCENTIVE_DIR, file), 'utf8'))
    .join('\n');
}

describe('commercial incentive boundaries', () => {
  const sources = readSources();

  it('requires explicit approval before an incentive is recorded', () => {
    expect(sources).toContain("action: 'approve' | 'dismiss'");
    expect(sources).toContain("status: input.action === 'approve' ? 'approved' : 'dismissed'");
    expect(sources).not.toContain('prisma.organization_workflow_agreements.update');
    expect(sources).not.toContain('extraction_result: recommendation');
    expect(sources).not.toContain('extraction_result: record');
  });

  it('does not send supplier communication or execute payment', () => {
    expect(sources).not.toContain('createTransfer');
    expect(sources).not.toContain('selectPayoutRail');
    expect(sources).not.toContain('@/lib/payouts');
    expect(sources).not.toContain('nodemailer');
    expect(sources).not.toContain('sendEmail');
    expect(sources).not.toContain('resend');
  });

  it('does not import ranking, passport scoring, Canton, or observation persistence', () => {
    expect(sources).not.toContain('observation-store.server');
    expect(sources).not.toContain('rankLandingRoutes');
    expect(sources).not.toContain('compareLandingRoutes');
    expect(sources).not.toContain('commercial-network');
    expect(sources).not.toContain('canton');
    expect(sources).not.toContain('assessOfferingReadiness');
    expect(sources).not.toContain('business-passport');
  });

  it('does not change extraction schema v5', () => {
    expect(sources).not.toContain('schemaVersion');
    expect(fs.readFileSync(path.join(INCENTIVE_DIR, 'recommend.ts'), 'utf8')).toContain(
      'recommendEarlyPaymentIncentive'
    );
  });
});
