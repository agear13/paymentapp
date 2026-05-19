#!/usr/bin/env node
/**
 * Reports largest Next.js route chunks for operational settlement routes.
 * Requires a prior `next build` (eslint can fail; chunks still emit on compile success).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CHUNKS_DIR = path.join(ROOT, '.next', 'static', 'chunks');

const ROUTE_FOCUS = [
  'payment-links',
  'transactions',
  'payouts',
  'settings/merchant',
  'pay',
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.js')) acc.push(full);
  }
  return acc;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const files = walk(CHUNKS_DIR);
if (files.length === 0) {
  console.error('No build chunks found. Run `next build` first.');
  process.exit(1);
}

const routeFiles = files
  .filter((file) => ROUTE_FOCUS.some((segment) => file.includes(segment)))
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .sort((a, b) => b.size - a.size);

const largest = files
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 15);

console.log('Operational route chunks:\n');
for (const entry of routeFiles) {
  console.log(`${kb(entry.size).padStart(10)}  ${path.relative(CHUNKS_DIR, entry.file)}`);
}

console.log('\nLargest shared chunks:\n');
for (const entry of largest) {
  console.log(`${kb(entry.size).padStart(10)}  ${path.relative(CHUNKS_DIR, entry.file)}`);
}

const paymentLinksPage = routeFiles.find((entry) =>
  entry.file.includes('dashboard\\payment-links\\page') ||
  entry.file.includes('dashboard/payment-links/page')
);

if (paymentLinksPage && paymentLinksPage.size > 250 * 1024) {
  console.error(
    `\nWARN: payment-links page chunk exceeds 250 KB (${kb(paymentLinksPage.size)}). Consider further code splitting.`
  );
  process.exit(1);
}

console.log('\nChunk audit passed operational thresholds.');
