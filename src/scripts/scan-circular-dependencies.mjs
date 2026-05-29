#!/usr/bin/env node
/**
 * Lightweight circular dependency detector for operational graph core.
 * Fails CI when new import cycles appear in protected architecture folders.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const scanDirs = [
  'lib/operations',
  'components/operations',
];

const KNOWN_CYCLES = new Set([
  normalizeCycle([
    'lib/operations/derivations/derive-approval-state.ts',
    'lib/operations/truth/payout-truth.ts',
    'lib/operations/truth/participant-truth.ts',
    'lib/operations/derivations/derive-approval-state.ts',
  ]),
]);

function normalizeCycle(cycle) {
  const unique = [...new Set(cycle)].sort();
  return unique.join(' → ');
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('@/')) return null;
  const target = path.join(root, spec.slice(2));
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    path.join(target, 'index.ts'),
    path.join(target, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return rel(c);
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

function parseImports(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const imports = [];
  const re = /^import\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const resolved = resolveImport(file, m[1]);
    if (resolved) imports.push(resolved);
  }
  return imports;
}

const graph = new Map();
for (const dir of scanDirs) {
  for (const file of collectFiles(dir)) {
    graph.set(file, parseImports(file));
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

console.log('Stage: circular-dependency-scan');
const cycles = findCycles();
const newCycles = cycles.filter((cycle) => !KNOWN_CYCLES.has(normalizeCycle(cycle)));

if (newCycles.length === 0) {
  if (cycles.length > 0) {
    console.log(`✓ ${cycles.length} known circular dependency cycle(s) — no new cycles detected.`);
  } else {
    console.log('✓ No circular dependencies in operational graph core.');
  }
  process.exit(0);
}

console.error(`✗ Circular dependency scan failed (${newCycles.length} new cycle(s)):\n`);
for (const cycle of newCycles) {
  console.error(`  ${cycle.join(' → ')}`);
}
process.exit(1);
