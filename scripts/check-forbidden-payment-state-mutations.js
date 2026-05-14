#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scanRoots = [
  path.join(repoRoot, 'src'),
  path.join(repoRoot, 'scripts'),
];

const allowedExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const skipDirs = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
]);

const forbiddenRules = [
  {
    name: 'legacy-state-machine-reference',
    regex: /payment-link-state-machine/g,
    message: 'Legacy payment state machine reference is forbidden.',
  },
  {
    name: 'direct-status-assignment',
    regex: /\b(?:paymentLink|payment_link|currentLink|link)\.status\s*=(?!=)/g,
    message: 'Direct payment link .status assignment is forbidden.',
  },
  {
    name: 'direct-payment-links-update-status',
    regex: /payment_links\.update(?:Many)?\s*\([\s\S]{0,280}?\bstatus\b\s*:/g,
    message: 'Direct payment_links.update/updateMany status mutation is forbidden.',
  },
  {
    name: 'raw-sql-payment-status-mutation',
    regex: /\$(?:executeRaw|queryRaw)[\s\S]{0,240}?update\s+payment_links\s+set[\s\S]{0,120}?\bstatus\b/gi,
    message: 'Raw SQL payment_links status mutation is forbidden.',
  },
];

const approvedPaymentConfirmedWriters = new Set([
  'src/lib/services/payment-confirmation.ts',
  'src/lib/hedera/payment-confirmation.ts',
  'src/app/api/hedera/transactions/verify/route.ts',
  'src/app/api/test/refund-atomicity/route.ts',
]);

/**
 * Non-production writers: kept explicit so CI does not silently ignore them.
 * Production settlement must converge through confirmPayment(); these files only
 * fabricate rows for local seed data or in-app demo scenarios.
 */
const allowlistedSeedDemoPaymentConfirmedWriters = new Set([
  'src/lib/db/seed.ts',
  'src/lib/deal-network-demo/pilot-deal-payment-events.server.ts',
]);

function isApprovedOrAllowlistedPaymentConfirmedWriter(rel) {
  return (
    approvedPaymentConfirmedWriters.has(rel) ||
    allowlistedSeedDemoPaymentConfirmedWriters.has(rel)
  );
}

/** True only when a payment_events.create/createMany call's argument block sets PAYMENT_CONFIRMED. */
function hasPaymentConfirmedInsert(text) {
  const eventTypeNeedle = /\bevent_type\s*:\s*['"]PAYMENT_CONFIRMED['"]/;
  /** Keep small: a large window crosses unrelated handlers and false-flags reads (e.g. filters). */
  const maxWindowChars = 1200;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const slice = text.slice(searchFrom);
    const m = /\bpayment_events\.create(?:Many)?\s*\(/.exec(slice);
    if (!m) break;
    const absStart = searchFrom + m.index;
    const window = text.slice(absStart, absStart + maxWindowChars);
    if (eventTypeNeedle.test(window)) return true;
    searchFrom = absStart + m[0].length;
  }
  return false;
}

const approvedDirectLedgerPostingCallers = new Set([
  'src/lib/services/payment-confirmation.ts',
  'src/lib/hedera/payment-confirmation.ts',
]);

function addViolation(violations, text, rel, index, rule, message, sample) {
  violations.push({
    file: rel,
    line: getLineNumber(text, index),
    rule,
    message,
    sample: sample.slice(0, 120).replace(/\s+/g, ' '),
  });
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!allowedExt.has(path.extname(entry.name))) continue;
    out.push(full);
  }
}

function getLineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

const files = [];
for (const root of scanRoots) walk(root, files);

const violations = [];
for (const file of files) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  if (rel.includes('__tests__')) continue;
  if (rel === 'scripts/check-forbidden-payment-state-mutations.js') continue;
  if (rel === 'src/lib/payments/state-machine.ts') continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of forbiddenRules) {
    rule.regex.lastIndex = 0;
    let match;
    while ((match = rule.regex.exec(text)) !== null) {
      violations.push({
        file: rel,
        line: getLineNumber(text, match.index),
        rule: rule.name,
        message: rule.message,
        sample: match[0].slice(0, 120).replace(/\s+/g, ' '),
      });
    }
  }

  // A) PAYMENT_CONFIRMED creation is tightly controlled (actual inserts only, not reads/filters).
  const hasPaymentConfirmedWrite = hasPaymentConfirmedInsert(text);
  if (
    hasPaymentConfirmedWrite &&
    !isApprovedOrAllowlistedPaymentConfirmedWriter(rel)
  ) {
    addViolation(
      violations,
      text,
      rel,
      text.indexOf('PAYMENT_CONFIRMED'),
      'unapproved-payment-confirmed-writer',
      'Direct PAYMENT_CONFIRMED insertion path is unapproved.',
      'payment_events.create + PAYMENT_CONFIRMED'
    );
  }

  // B) Settlement should converge through confirmPayment().
  // Heuristic: non-test files that write PAYMENT_CONFIRMED should call confirmPayment
  // unless they are explicitly approved canonical writers.
  const isTestLike =
    rel.includes('__tests__') || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx');
  const hasPaymentEventCreate = /\bpayment_events\.create(?:Many)?\s*\(/.test(text);
  const hasStatusWriteMutation =
    /\bpayment_links\.update(?:Many)?\s*\([\s\S]{0,280}?\bstatus\b\s*:/.test(text) ||
    /\b(?:paymentLink|payment_link|currentLink|link)\.status\s*=(?!=)/.test(text) ||
    /\$(?:executeRaw|queryRaw)[\s\S]{0,240}?update\s+payment_links\s+set[\s\S]{0,120}?\bstatus\b/i.test(text);
  const hasDirectSettlementCall = /\bpost(?:Stripe|Hedera|Wise)Settlement\s*\(/.test(text);
  const looksLikeSettlementWriter =
    hasPaymentEventCreate || hasStatusWriteMutation || hasDirectSettlementCall;

  if (
    hasPaymentConfirmedWrite &&
    looksLikeSettlementWriter &&
    !/\bconfirmPayment\s*\(/.test(text) &&
    !isApprovedOrAllowlistedPaymentConfirmedWriter(rel) &&
    !isTestLike
  ) {
    addViolation(
      violations,
      text,
      rel,
      text.indexOf('PAYMENT_CONFIRMED'),
      'settlement-bypass-confirm-payment',
      'Settlement path references PAYMENT_CONFIRMED without converging through confirmPayment().',
      'PAYMENT_CONFIRMED without confirmPayment()'
    );
  }

  // C) Direct settlement ledger posting is only allowed in canonical orchestrators.
  const directLedgerPostingMatch = /\bpost(?:Stripe|Hedera|Wise)Settlement\s*\(/.exec(text);
  const isPostingRuleModule = rel.startsWith('src/lib/ledger/posting-rules/');
  if (directLedgerPostingMatch && !isPostingRuleModule && !approvedDirectLedgerPostingCallers.has(rel)) {
    addViolation(
      violations,
      text,
      rel,
      directLedgerPostingMatch.index,
      'unapproved-direct-ledger-settlement',
      'Direct settlement ledger posting is unapproved outside canonical settlement orchestration.',
      directLedgerPostingMatch[0]
    );
  }
}

if (violations.length > 0) {
  console.error('Settlement/payment integrity check failed.');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} [${v.rule}] ${v.message}`);
    console.error(`  sample: ${v.sample}`);
  }
  process.exit(1);
}

console.log('Payment state integrity check passed.');
