import fs from 'fs';
import path from 'path';

const XLAYER_DIR = [
  path.join(process.cwd(), 'lib/xlayer'),
  path.join(process.cwd(), 'src/lib/xlayer'),
].find((dir) => fs.existsSync(dir));

if (!XLAYER_DIR) {
  throw new Error('Could not find src/lib/xlayer');
}

function readSources(): string {
  return fs
    .readdirSync(XLAYER_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(XLAYER_DIR, file), 'utf8'))
    .join('\n');
}

describe('xlayer module boundaries', () => {
  const sources = readSources();

  it('does not import payment transfer helpers or payment ABI', () => {
    expect(sources).not.toContain('sendErc20Payment');
    expect(sources).not.toContain('erc20Abi');
    expect(sources).not.toContain('@/lib/evm/metamask-client');
    expect(sources).not.toContain('@/lib/evm/networks');
    expect(sources).not.toContain('@/lib/evm/alchemy');
    expect(sources).not.toContain('ALCHEMY_API_KEY');
  });

  it('does not import ranking, passport, Canton, or payout execution', () => {
    expect(sources).not.toContain('route-intelligence');
    expect(sources).not.toContain('rankLandingRoutes');
    expect(sources).not.toContain('business-passport');
    expect(sources).not.toContain('canton');
    expect(sources).not.toContain('@/lib/payouts');
    expect(sources).not.toContain('saveEarlyPaymentIncentiveDecision');
  });

  it('does not mutate extracted payment terms or execute payment', () => {
    expect(sources).not.toContain('prisma.organization_workflow_agreements.update');
    expect(sources).not.toContain('createTransfer');
    expect(sources).not.toContain('confirmPayment');
  });

  it('registers only the commitment registry function', () => {
    expect(sources).toContain("functionName: 'registerCommitment'");
    expect(sources).not.toContain("functionName: 'transfer'");
  });
});
