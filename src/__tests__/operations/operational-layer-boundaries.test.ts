import fs from 'node:fs';
import path from 'node:path';
import { assertOperationalLayerBoundaries } from '@/lib/operations/dev/operational-layer-boundary-guards';

const ROOT = path.join(__dirname, '..', '..', 'lib', 'operations');

const BOUNDARY_FILES = [
  'dev/assert-post-convergence-integrity.ts',
  'dev/post-convergence-integrity-types.ts',
  'dev/post-convergence-integrity-runner.ts',
  'dev/post-convergence-verifier.ts',
  'telemetry/operational-telemetry.ts',
  'orchestration/operational-convergence-resilience.ts',
  'orchestration/operational-sync-convergence.ts',
  'orchestration/operational-sync-client.ts',
  'sync/fetch-coordination-snapshot-data.ts',
  'sync/operational-sync-types.ts',
  'sync/operational-sync-helpers.ts',
  'sync/operational-sync-events.ts',
];

function readSources(): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const rel of BOUNDARY_FILES) {
    const full = path.join(ROOT, rel);
    sources[rel] = fs.readFileSync(full, 'utf8');
  }
  return sources;
}

describe('operational layer dependency boundaries', () => {
  it('enforces directional imports across sync orchestration layers', () => {
    expect(() => assertOperationalLayerBoundaries(readSources())).not.toThrow();
  });

  it('rejects verification importing orchestration convergence', () => {
    const sources = readSources();
    sources['dev/assert-post-convergence-integrity.ts'] +=
      "\nimport x from '@/lib/operations/orchestration/operational-sync-convergence';\n";
    expect(() => assertOperationalLayerBoundaries(sources)).toThrow(/verification layer violation/);
  });

  it('rejects resilience importing orchestration convergence', () => {
    const sources = readSources();
    sources['orchestration/operational-convergence-resilience.ts'] +=
      "\nimport x from '@/lib/operations/orchestration/operational-sync-convergence';\n";
    expect(() => assertOperationalLayerBoundaries(sources)).toThrow(/resilience layer violation/);
  });

  it('rejects telemetry importing orchestration modules', () => {
    const sources = readSources();
    sources['telemetry/operational-telemetry.ts'] +=
      "\nimport x from '@/lib/operations/orchestration/operational-sync-client';\n";
    expect(() => assertOperationalLayerBoundaries(sources)).toThrow(/telemetry layer violation/);
  });
});
