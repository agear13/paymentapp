#!/usr/bin/env node
/**
 * Static scan for common JSX/util references missing imports in .tsx files.
 * Exit code 1 when issues are found.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

const FOCUS_PREFIXES = [
  'components/payment-links',
  'components/public',
  'components/payment-links-onboarding',
  'app/(dashboard)/dashboard/payment-links',
  'app/(dashboard)/dashboard/transactions',
  'app/(dashboard)/dashboard/payouts',
  'app/(dashboard)/dashboard/ledger',
  'app/(public)/pay',
];

const JSX_COMPONENTS = [
  'Button',
  'Input',
  'Select',
  'Checkbox',
  'Tabs',
  'TabsList',
  'TabsTrigger',
  'TabsContent',
  'Badge',
  'Dialog',
  'DialogContent',
  'Popover',
  'PopoverContent',
  'Alert',
  'Card',
  'CardContent',
];

const UTIL_CALLS = [
  'formatCurrency',
  'formatCompactCurrency',
  'cn',
  'operationalStatusLabel',
  'getPaymentLinkUrl',
  'resolveMerchantLogoUrl',
];

const PRIMITIVE_DEFINITIONS = new Set([
  path.join('components', 'ui', 'button.tsx'),
  path.join('components', 'ui', 'input.tsx'),
  path.join('components', 'ui', 'select.tsx'),
  path.join('components', 'ui', 'checkbox.tsx'),
  path.join('components', 'ui', 'tabs.tsx'),
  path.join('components', 'ui', 'badge.tsx'),
  path.join('components', 'ui', 'dialog.tsx'),
  path.join('components', 'ui', 'popover.tsx'),
  path.join('components', 'ui', 'alert.tsx'),
  path.join('components', 'ui', 'card.tsx'),
]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (full.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

function hasImport(source, symbol) {
  const patterns = [
    new RegExp(`import\\s+\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s+from`),
    new RegExp(`import\\s+${symbol}\\s+from`),
  ];
  return patterns.some((p) => p.test(source));
}

function usesJsxComponent(source, symbol) {
  const re = new RegExp(`<${symbol}(\\s|>|/)`, 'g');
  return re.test(source);
}

function usesUtilCall(source, symbol) {
  const re = new RegExp(`\\b${symbol}\\s*\\(`, 'g');
  let match;
  while ((match = re.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      return true;
    }
  }
  return false;
}

function isFocusedFile(relPath) {
  const normalized = relPath.split(path.sep).join('/');
  return FOCUS_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath);
  if (!isFocusedFile(rel)) return [];
  if (PRIMITIVE_DEFINITIONS.has(rel.split(path.sep).join(path.sep))) return [];

  const issues = [];

  for (const symbol of JSX_COMPONENTS) {
    if (usesJsxComponent(source, symbol) && !hasImport(source, symbol)) {
      issues.push({ file: rel, symbol, kind: 'jsx' });
    }
  }

  for (const symbol of UTIL_CALLS) {
    if (usesUtilCall(source, symbol) && !hasImport(source, symbol)) {
      issues.push({ file: rel, symbol, kind: 'util' });
    }
  }

  return issues;
}

const allIssues = [];
for (const file of walk(ROOT)) {
  allIssues.push(...scanFile(file));
}

if (allIssues.length === 0) {
  console.log('UI import verification passed (operational settlement scope).');
  process.exit(0);
}

console.error('UI import verification failed:\n');
for (const issue of allIssues) {
  console.error(`- ${issue.file}: missing import for ${issue.symbol} (${issue.kind})`);
}
process.exit(1);
