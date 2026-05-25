#!/usr/bin/env node
/**
 * Duplicate import scanner — fails CI on duplicate named/default imports.
 * Prevents Render/webpack failures like:
 *   Identifier 'deriveParticipantCapabilityFlags' has already been declared
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const scanRoots = [
  'lib/operations',
  'components/operations',
  'lib/payouts',
  'hooks/use-operational-guidance.ts',
  'hooks/use-operational-audit-store.ts',
  'hooks/use-global-operational-sync.ts',
  'app/api/operations',
  'app/api/payout-batches',
  'app/api/payouts',
  'app/api/deal-network-pilot',
];

const issues = [];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const byModule = new Map();

  const importRe =
    /^import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s+['"]([^'"]+)['"]/gm;

  let match;
  while ((match = importRe.exec(text)) !== null) {
    const defaultImport = match[1];
    const namedBlock = match[2];
    const mod = match[3];

    if (defaultImport) {
      const key = `${mod}::default::${defaultImport}`;
      if (byModule.has(key)) {
        issues.push({
          file: rel(file),
          kind: 'duplicate-default-import',
          symbol: defaultImport,
          module: mod,
        });
      }
      byModule.set(key, true);
    }

    if (!namedBlock) continue;

    const seenInStatement = new Set();
    for (const part of namedBlock.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const alias = trimmed.includes(' as ')
        ? trimmed.split(/\s+as\s+/)[1].trim()
        : trimmed.split(/\s+as\s+/)[0].trim();

      if (seenInStatement.has(alias)) {
        issues.push({
          file: rel(file),
          kind: 'duplicate-named-in-import',
          symbol: alias,
          module: mod,
        });
      }
      seenInStatement.add(alias);

      const key = `${mod}::named::${alias}`;
      if (byModule.has(key)) {
        issues.push({
          file: rel(file),
          kind: 'duplicate-named-across-imports',
          symbol: alias,
          module: mod,
        });
      }
      byModule.set(key, true);
    }
  }
}

function walk(entry) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) return;
  if (fs.statSync(full).isFile()) {
    if (/\.(ts|tsx)$/.test(full)) scanFile(full);
    return;
  }
  for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      walk(path.relative(root, p));
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      scanFile(p);
    }
  }
}

console.log('Stage: duplicate-import-scan');
for (const entry of scanRoots) walk(entry);

if (issues.length === 0) {
  console.log('✓ No duplicate import issues found.');
  process.exit(0);
}

console.error(`✗ Duplicate import scan failed (${issues.length} issue(s)):\n`);
for (const issue of issues) {
  console.error(
    `  [${issue.kind}] ${issue.file}\n` +
      `    symbol: ${issue.symbol}\n` +
      `    module: ${issue.module}\n`
  );
}
process.exit(1);
