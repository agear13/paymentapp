import fs from 'fs';
import path from 'path';
import {
  assertFoundationalSemanticsLayerInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

const SHARED_SEMANTICS_PATH = path.join(
  process.cwd(),
  'lib/operations/shared/attribution-compensation-semantics.ts'
);

describe('foundational semantics layer imports', () => {
  it('shared attribution semantics does not import truth or derivation layers', () => {
    const source = fs.readFileSync(SHARED_SEMANTICS_PATH, 'utf8');
    const forbidden = [
      '/operations/truth/',
      '/operations/derivations/',
      '/operations/orchestration/',
      '/operations/selectors/',
    ];
    for (const segment of forbidden) {
      expect(source.includes(segment)).toBe(false);
    }
  });

  it('throws FOUNDATIONAL_SEMANTICS_LAYER_IMPORT_VIOLATION in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertFoundationalSemanticsLayerInvariants({
        foundationalSemanticsLayerImportViolation: true,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
