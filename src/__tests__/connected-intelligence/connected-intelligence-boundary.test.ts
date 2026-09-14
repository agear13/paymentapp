import fs from 'fs';
import path from 'path';

const CONNECTED_DIR = path.join(process.cwd(), 'lib/connected-intelligence');
const CONNECTED_DIR_ALT = path.join(process.cwd(), 'src/lib/connected-intelligence');
const ROUTE_INTELLIGENCE_DIR = [
  path.join(process.cwd(), 'lib/route-intelligence'),
  path.join(process.cwd(), 'src/lib/route-intelligence'),
].find((dir) => fs.existsSync(dir));

function readConnectedSources(): string {
  const dir = fs.existsSync(CONNECTED_DIR) ? CONNECTED_DIR : CONNECTED_DIR_ALT;
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n');
}

function readModuleSources(dir: string): string {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n');
}

describe('connected-intelligence boundaries', () => {
  const connectedSources = readConnectedSources();
  const routeIntelligenceSources = ROUTE_INTELLIGENCE_DIR
    ? readModuleSources(ROUTE_INTELLIGENCE_DIR)
    : '';

  it('does not import execution Wise client modules or persist customer observations', () => {
    expect(connectedSources).not.toContain('@/lib/wise');
    expect(connectedSources).not.toContain('createTransfer');
    expect(connectedSources).not.toContain('observation-store.server');
    expect(connectedSources).not.toContain('persistRouteFxObservation');
    expect(connectedSources).not.toContain('persistProviderFeeObservation');
    expect(connectedSources).not.toContain('landing-recommendation-explanation');
    expect(connectedSources).not.toContain('recommendation-explanation');
  });

  it('keeps route-intelligence free of connected-intelligence imports', () => {
    expect(routeIntelligenceSources).not.toContain('connected-intelligence');
  });

  it('requires authentication on connected intelligence API routes', () => {
    const apiRoutes = [
      path.join(process.cwd(), 'app/api/connected-intelligence/wise-flagship/route.ts'),
      path.join(process.cwd(), 'app/api/connected-intelligence/wise-consent/route.ts'),
    ].filter((file) => fs.existsSync(file));

    expect(apiRoutes.length).toBe(2);
    for (const file of apiRoutes) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toContain('getCurrentUserForApi');
      expect(source).toContain('if (!auth.user) return auth.response');
    }
  });

  it('keeps public comparison and ranking free of connected-intelligence imports', () => {
    const publicFiles = [
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'),
      path.join(process.cwd(), 'lib/journey/landing-provider-search.ts'),
      path.join(process.cwd(), 'src/lib/journey/landing-route-comparison.ts'),
      path.join(process.cwd(), 'src/lib/journey/landing-route-rank.ts'),
      path.join(process.cwd(), 'src/lib/journey/landing-provider-search.ts'),
    ].filter((file) => fs.existsSync(file));

    for (const file of publicFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('connected-intelligence');
      expect(source).not.toContain('evaluateConnectedWiseFlagship');
      expect(source).not.toContain('requestWiseFlagshipQuote');
    }
  });
});
