/**
 * No-op stub for Next.js `server-only` when running under plain Node (tsx scripts).
 * Must load before any transitive import of `import 'server-only'`.
 */
import Module from 'node:module';

type CjsLoad = (request: string, parent: NodeModule, isMain: boolean) => unknown;

const moduleRuntime = Module as unknown as { _load: CjsLoad };
const originalLoad = moduleRuntime._load;

moduleRuntime._load = function loadWithServerOnlyStub(
  request: string,
  parent: NodeModule,
  isMain: boolean
): unknown {
  if (request === 'server-only') {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
