#!/usr/bin/env node
/**
 * Heuristic scanner for within-file TDZ patterns.
 *
 * Looks for:
 *   1. Module-level const/let that calls a function using another module-level const
 *      declared *later* in the same file.
 *   2. Re-export statements that create runtime bindings (which the cycle scanner handles).
 *
 * This is a heuristic — false positives are possible.
 * Output is evidence for manual review, not definitive proof.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// All directories touched by the participants page
const scanDirs = [
  'lib/ai-extractor',
  'lib/operations',
  'lib/onboarding',
  'lib/participants',
  'components/operations',
  'components/workflow',
  'components/projects',
  'components/dev',
  'hooks',
];

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
      files.push(path.relative(root, p).replace(/\\/g, '/'));
    }
  }
  return files;
}

function analyzeFile(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = text.split('\n');

  // Collect module-level const/let declarations (not inside functions/classes)
  // Pattern: top-level (not indented) const/let/var NAME = ...
  const moduleConsts = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match top-level: no leading whitespace, starts with export const/let/const/let
    const m = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/);
    if (m) {
      moduleConsts.push({ name: m[1], lineNum: i + 1, line });
    }
  }

  // Look for a const that USES another module-level const declared LATER
  const findings = [];
  for (let i = 0; i < moduleConsts.length; i++) {
    const curr = moduleConsts[i];
    // Extract what identifiers are used in the declaration value
    // Crude: look for identifiers used on the right-hand side
    const rhs = curr.line.slice(curr.line.indexOf('=') + 1);
    for (let j = i + 1; j < moduleConsts.length; j++) {
      const later = moduleConsts[j];
      // Check if the current declaration references the later one by name
      // Use word boundary to avoid false matches
      const pattern = new RegExp(`\\b${later.name}\\b`);
      if (pattern.test(rhs)) {
        findings.push({
          file,
          usedAt: curr.lineNum,
          usedLine: curr.line.trim(),
          laterAt: later.lineNum,
          laterLine: later.line.trim(),
          symbol: later.name,
        });
      }
    }
  }
  return findings;
}

const allFindings = [];
for (const dir of scanDirs) {
  for (const file of collectFiles(dir)) {
    const findings = analyzeFile(file);
    allFindings.push(...findings);
  }
}

if (allFindings.length === 0) {
  console.log('No within-file TDZ patterns detected.');
} else {
  console.log(`Within-file TDZ patterns found: ${allFindings.length}\n`);
  for (const f of allFindings) {
    console.log(`FILE: ${f.file}`);
    console.log(`  Line ${f.usedAt}: ${f.usedLine}`);
    console.log(`    ↳ uses '${f.symbol}' which is declared at line ${f.laterAt}:`);
    console.log(`    ${f.laterLine}`);
    console.log();
  }
}
