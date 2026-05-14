/**
 * CLI: deterministic revenue-share / commission verification matrix (stdout).
 * Usage (from src/): npx tsx scripts/verify-revenue-share-matrix.ts
 */

import { formatRevenueShareMatrixLines } from '../lib/verification/revenue-share-matrix';

console.log(formatRevenueShareMatrixLines().join('\n'));
