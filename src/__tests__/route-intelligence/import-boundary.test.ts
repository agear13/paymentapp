import fs from 'fs';
import path from 'path';

const ROUTE_INTELLIGENCE_DIR = [
  path.join(process.cwd(), 'lib/route-intelligence'),
  path.join(process.cwd(), 'src/lib/route-intelligence'),
].find((dir) => fs.existsSync(dir));

if (!ROUTE_INTELLIGENCE_DIR) {
  throw new Error('Could not find src/lib/route-intelligence');
}

const FORBIDDEN_IMPORTS = [
  '@/lib/wise',
  '@/lib/payouts',
  '@/lib/stripe',
  '@/lib/payments/payment-rail-registry',
  '@/lib/payouts/select-payout-rail',
  '@/lib/auth',
  '@/lib/fx',
  'https://api.wise.com',
  'api.sandbox.airwallex.com',
  'api.stripe.com',
];

function readModuleSources(): string {
  return fs
    .readdirSync(ROUTE_INTELLIGENCE_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(ROUTE_INTELLIGENCE_DIR, file), 'utf8'))
    .join('\n');
}

describe('route-intelligence import boundary', () => {
  const sources = readModuleSources();

  it('does not import execution, payout, collection, FX, or MFA modules', () => {
    for (const forbidden of FORBIDDEN_IMPORTS) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('depends on the existing catalogue and curated feed only', () => {
    expect(sources).toContain('@/lib/journey/landing-provider-catalog');
    expect(sources).toContain('@/lib/journey/payment-intelligence-feed');
    expect(sources).not.toContain('rankRoutesV2');
    expect(sources).not.toContain('bestRoute');
    expect(sources).not.toContain('aiRank');
    expect(sources).not.toContain('liveRank');
    expect(sources).not.toContain('selectPayoutRail');
    expect(sources).not.toContain('openai');
    expect(sources).not.toContain('anthropic');
    expect(sources).not.toContain('@/lib/agreement-analyzer');
  });

  it('may call status.wise.com but not api.wise.com or execution clients', () => {
    expect(sources).toContain('status.wise.com');
    expect(sources).not.toContain('https://api.wise.com');
    expect(sources).not.toContain('@/lib/wise');
    expect(sources).not.toContain('openai');
    expect(sources).not.toContain('anthropic');
  });
});
