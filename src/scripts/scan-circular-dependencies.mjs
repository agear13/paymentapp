#!/usr/bin/env node
/**
 * Runtime circular dependency detector.
 *
 * Scans protected architecture domains and fails CI when new runtime import
 * cycles appear. Type-only imports (`import type`) are explicitly excluded —
 * only value imports that execute at module initialization time are checked.
 *
 * Covered domains:
 *   lib/ai-extractor    — extraction engine (zero cycles required)
 *   lib/operations      — operational graph core
 *   components/operations
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const scanDirs = [
  'lib/ai-extractor',
  'lib/operations',
  'components/operations',
];

/**
 * Cycles that are known and accepted pending a dedicated fix.
 * Format: sorted unique nodes joined with " → ".
 * The ai-extractor section must remain empty after the V6.1 refactor.
 */
const KNOWN_CYCLES = new Set([
  // lib/operations — approved known cycles (pre-existing)
  normalizeCycle([
    'lib/operations/derivations/derive-approval-state.ts',
    'lib/operations/truth/payout-truth.ts',
    'lib/operations/truth/participant-truth.ts',
    'lib/operations/derivations/derive-approval-state.ts',
  ]),
  // lib/ai-extractor — MUST REMAIN EMPTY
  // Any new entry here requires a code review explaining why the cycle is unavoidable.
]);

function normalizeCycle(cycle) {
  const unique = [...new Set(cycle)].sort();
  return unique.join(' → ');
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

/**
 * Resolve an import specifier to a repository-relative path.
 * Handles both `@/` path aliases and relative specifiers.
 * Returns null for node_modules and external packages.
 */
function resolveImport(fromFile, spec) {
  let target;

  if (spec.startsWith('@/')) {
    // Alias import: @/lib/foo → <root>/lib/foo
    target = path.join(root, spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    // Relative import: resolve from the directory of the importing file
    target = path.resolve(path.join(root, path.dirname(fromFile)), spec);
  } else {
    // External package — not tracked
    return null;
  }

  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    path.join(target, 'index.ts'),
    path.join(target, 'index.tsx'),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return rel(c);
    } catch {
      // ignore
    }
  }
  return null;
}

function collectFiles(dir) {
  const files = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return files;
  for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
      files.push(...collectFiles(path.relative(root, p)));
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.(ts|tsx)$/.test(ent.name)) {
      files.push(rel(p));
    }
  }
  return files;
}

/**
 * Parse runtime (non-type) imports from a TypeScript/TSX file.
 *
 * Skips:
 *   import type { ... } from '...'       — type erasure, no runtime binding
 *   import type * as Foo from '...'      — same
 *
 * Includes:
 *   import { foo } from '...'            — runtime value import
 *   import * as Foo from '...'           — namespace import (values)
 *   import Foo from '...'               — default import (value)
 *   import '...'                         — side-effect import
 */
function parseRuntimeImports(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const imports = [];

  // Match import statements — capture the module specifier
  // Explicitly exclude `import type` to avoid false positives
  const re = /^import\s+(type\s+)?.*?from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const isTypeOnly = Boolean(m[1]); // "type " capture group
    if (isTypeOnly) continue;        // skip — type-only, stripped at runtime

    const resolved = resolveImport(file, m[2]);
    if (resolved) imports.push(resolved);
  }

  // Also match side-effect imports: import 'foo'
  const sideEffect = /^import\s+['"]([^'"]+)['"]/gm;
  while ((m = sideEffect.exec(text)) !== null) {
    const resolved = resolveImport(file, m[1]);
    if (resolved) imports.push(resolved);
  }

  return [...new Set(imports)]; // deduplicate
}

// Build the runtime dependency graph
const graph = new Map();
for (const dir of scanDirs) {
  for (const file of collectFiles(dir)) {
    graph.set(file, parseRuntimeImports(file));
  }
}

function findCycles() {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function dfs(node) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) cycles.push([...stack.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    stack.push(node);

    for (const next of graph.get(node) ?? []) {
      if (graph.has(next)) dfs(next);
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) dfs(node);
  return cycles;
}

// ── Run detection ─────────────────────────────────────────────────────────────

console.log('Stage: circular-dependency-scan (runtime imports only)');

const allCycles = findCycles();

// Separate ai-extractor cycles — they must always be zero
const extractorCycles = allCycles.filter((c) =>
  c.some((f) => f.startsWith('lib/ai-extractor/'))
);
const otherCycles = allCycles.filter((c) =>
  !c.some((f) => f.startsWith('lib/ai-extractor/'))
);
const newOtherCycles = otherCycles.filter((c) => !KNOWN_CYCLES.has(normalizeCycle(c)));

let exitCode = 0;

// ai-extractor: zero tolerance
if (extractorCycles.length > 0) {
  console.error(`\n✗ lib/ai-extractor: ${extractorCycles.length} runtime circular dependency cycle(s) detected.\n`);
  console.error('  These must be eliminated — see src/lib/ai-extractor/deliverable/ and');
  console.error('  src/lib/ai-extractor/currency/ for the established refactor pattern.\n');
  for (const cycle of extractorCycles) {
    console.error(`  CYCLE: ${cycle.join(' → ')}`);
  }
  exitCode = 1;
} else {
  console.log('✓ lib/ai-extractor: 0 runtime circular dependencies.');
}

// Other domains: fail on new cycles, tolerate known ones
if (newOtherCycles.length > 0) {
  console.error(`\n✗ New circular dependencies detected in other domains (${newOtherCycles.length}):\n`);
  for (const cycle of newOtherCycles) {
    console.error(`  CYCLE: ${cycle.join(' → ')}`);
  }
  exitCode = 1;
} else {
  const knownCount = otherCycles.length - newOtherCycles.length;
  if (knownCount > 0) {
    console.log(`✓ Other domains: ${knownCount} known cycle(s) — no new cycles detected.`);
  } else {
    console.log('✓ Other domains: 0 circular dependencies.');
  }
}

process.exit(exitCode);
