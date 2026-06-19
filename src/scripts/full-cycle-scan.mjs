#!/usr/bin/env node
/**
 * Temporary broad cycle scanner for V6.1 investigation.
 * Covers all directories touched by the Participants page.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const scanDirs = [
  'lib/ai-extractor',
  'lib/operations',
  'lib/onboarding',
  'lib/participants',
  'lib/projects',
  'lib/entitlements',
  'lib/currency',
  'lib/design',
  'components/operations',
  'components/workflow',
  'components/projects',
  'components/dev',
  'components/entitlements',
  'hooks',
];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function resolveImport(fromFile, spec) {
  let target;
  if (spec.startsWith('@/')) {
    target = path.join(root, spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    target = path.resolve(path.join(root, path.dirname(fromFile)), spec);
  } else {
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
    } catch {}
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

function parseRuntimeImports(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const imports = [];

  // import { ... } from '...'  AND  import Foo from '...'  AND  import * as Foo from '...'
  // Skip import type { ... } from '...'
  const importRe = /^import\s+(type\s+)?.*?from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = importRe.exec(text)) !== null) {
    if (m[1]) continue; // skip import type
    const r = resolveImport(file, m[2]);
    if (r) imports.push(r);
  }

  // export { ... } from '...'  — re-export with named bindings (runtime live binding)
  // Skip:  export type { ... } from '...'
  const reExportNamedRe = /^export\s+(type\s+)?\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/gm;
  while ((m = reExportNamedRe.exec(text)) !== null) {
    if (m[1]) continue; // skip export type
    const r = resolveImport(file, m[2]);
    if (r) imports.push(r);
  }

  // export * from '...'  — re-export all (runtime)
  const reExportStarRe = /^export\s+\*\s+(?:as\s+\w+\s+)?from\s+['"]([^'"]+)['"]/gm;
  while ((m = reExportStarRe.exec(text)) !== null) {
    const r = resolveImport(file, m[1]);
    if (r) imports.push(r);
  }

  return [...new Set(imports)];
}

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

const cycles = findCycles();
console.log(`Total runtime cycles found: ${cycles.length}`);
for (const c of cycles) {
  console.log('  CYCLE:', c.join('\n      -> '));
  console.log();
}
