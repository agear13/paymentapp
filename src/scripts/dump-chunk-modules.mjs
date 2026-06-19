#!/usr/bin/env node
/**
 * Dumps each module in a webpack chunk with:
 * - module ID
 * - exports (minified names)
 * - let/const declarations at module scope
 * - first 120 chars of body
 */
import fs from 'fs';

const chunkPath = process.argv[2];
const chunk = fs.readFileSync(chunkPath, 'utf8');

const modRe = /(\d{4,5}):\(e,t,n\)=>/g;
let m;
const mods = [];
while ((m = modRe.exec(chunk)) !== null) mods.push({ id: parseInt(m[1]), pos: m.index });

for (let i = 0; i < mods.length; i++) {
  const start = mods[i].pos;
  const end = i + 1 < mods.length ? mods[i + 1].pos : chunk.length;
  const body = chunk.slice(start, end);

  // Find module exports
  const exportRe = /n\.d\(t,\{([^}]+)\}/;
  const exportMatch = body.match(exportRe);
  const exports = exportMatch ? exportMatch[1].split(',').map(s => s.split(':')[0].trim()) : [];

  // Find let/const at module scope (first 1000 chars, outside function bodies)
  const letRe = /\blet\s+(\w+)\s*=/g;
  const moduleLets = [];
  let lm;
  const header = body.slice(0, 1000);
  while ((lm = letRe.exec(header)) !== null) {
    moduleLets.push(lm[1]);
  }

  // Get imports list
  const reqRe = /n\((\d+)\)/g;
  let rm;
  const reqs = new Set();
  const headerReqs = body.slice(0, 800);
  while ((rm = reqRe.exec(headerReqs)) !== null) reqs.add(parseInt(rm[1]));

  // Only show modules with let/const at scope or that are large
  const size = end - start;
  if (moduleLets.length > 0 || size > 5000) {
    console.log(`\n=== Module ${mods[i].id} (${size} bytes) ===`);
    console.log(`  Exports: ${exports.join(', ')}`);
    console.log(`  Module-level let: ${moduleLets.join(', ') || 'none'}`);
    console.log(`  Requires: ${[...reqs].join(', ')}`);
    console.log(`  Preview: ${body.slice(0, 200).trim()}`);
  }
}
