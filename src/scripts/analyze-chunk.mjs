#!/usr/bin/env node
import fs from 'fs';

const chunkPath = process.argv[2];
const chunk = fs.readFileSync(chunkPath, 'utf8');

// Find module boundaries
const modRe = /(\d{4,5}):\(e,t,n\)=>/g;
let m;
const mods = [];
while ((m = modRe.exec(chunk)) !== null) {
  mods.push({ id: parseInt(m[1]), pos: m.index });
}
console.log(`Total modules: ${mods.length}`);

// Check each module for const/let at module scope
for (let i = 0; i < mods.length; i++) {
  const start = mods[i].pos;
  const end = i + 1 < mods.length ? mods[i + 1].pos : chunk.length;
  const modContent = chunk.slice(start, end);

  const constMatches = modContent.match(/\bconst\s+\w/g) ?? [];
  const letMatches = modContent.match(/\blet\s+\w/g) ?? [];
  if (constMatches.length + letMatches.length > 0) {
    console.log(`\nModule ${mods[i].id}: ${constMatches.length} const, ${letMatches.length} let`);
    // Show first 300 chars of the module body (after module header)
    const body = modContent.slice(modContent.indexOf('=>') + 2, modContent.indexOf('=>') + 320);
    console.log('  Body preview:', body.trim().slice(0, 250));
  }
}
