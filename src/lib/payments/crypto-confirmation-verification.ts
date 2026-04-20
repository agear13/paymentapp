/**
 * Assisted verification for manual crypto payment confirmations (Payment Links only).
 * Heuristic checks — not on-chain proof.
 */

import type { CryptoVerificationStatus, MatchConfidence } from '@prisma/client';
import { finalizeVerification } from '@/lib/payments/manual-confirmation-verification';

export type CryptoVerificationResult = {
  verification_status: CryptoVerificationStatus;
  match_confidence: MatchConfidence;
  verification_issues: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectNetworkFamily(merchantNetwork: string): 'evm' | 'solana' | 'bitcoin' | 'unknown' {
  const n = norm(merchantNetwork);
  if (
    n.includes('ethereum') ||
    n.includes('arbitrum') ||
    n.includes('polygon') ||
    n.includes('optimism') ||
    n.includes('base') ||
    n.includes('bsc') ||
    n.includes('bnb') ||
    n.includes('avalanche') ||
    n.includes('gnosis') ||
    n.includes('linea') ||
    n === 'evm'
  ) {
    return 'evm';
  }
  if (n.includes('solana') || n === 'sol') return 'solana';
  if (n.includes('bitcoin') || n === 'btc') return 'bitcoin';
  return 'unknown';
}

/** Ethereum-style: 0x + 64 hex (optionally longer for some chains). */
export function isLikelyEvmTxHash(hash: string): boolean {
  const h = hash.trim();
  return /^0x[a-fA-F0-9]{64}$/.test(h);
}

/** Solana: base58, typical length 87–88 (signatures). */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,100}$/;

export function isLikelySolanaTxSig(sig: string): boolean {
  const s = sig.trim();
  return BASE58.test(s) && s.length >= 80 && s.length <= 90;
}

/** Bitcoin txid: 64 hex, no 0x prefix typically. */
export function isLikelyBtcTxId(hash: string): boolean {
  const h = hash.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(h)) return true;
  return /^[a-fA-F0-9]{64}$/i.test(h);
}

export function validateTxHashFormat(
  txHash: string | null | undefined,
  merchantNetwork: string
): { valid: boolean; issue?: string } {
  if (txHash == null || !txHash.trim()) {
    return { valid: true };
  }
  const h = txHash.trim();
  const family = detectNetworkFamily(merchantNetwork);

  if (family === 'evm') {
    if (!isLikelyEvmTxHash(h)) {
      return {
        valid: false,
        issue: 'Transaction hash does not match EVM format (expected 0x + 64 hex characters)',
      };
    }
    return { valid: true };
  }
  if (family === 'solana') {
    if (!isLikelySolanaTxSig(h)) {
      return {
        valid: false,
        issue: 'Transaction signature does not match typical Solana base58 format',
      };
    }
    return { valid: true };
  }
  if (family === 'bitcoin') {
    if (!isLikelyBtcTxId(h)) {
      return {
        valid: false,
        issue: 'Transaction id does not match typical Bitcoin hex format',
      };
    }
    return { valid: true };
  }
  // Unknown network: soft pass with optional length check
  if (h.length < 16) {
    return { valid: false, issue: 'Transaction hash looks too short for a typical on-chain id' };
  }
  return { valid: true };
}

function networksLooselyMatch(requested: string, payer: string): { match: boolean; fuzzy: boolean } {
  const a = norm(requested);
  const b = norm(payer);
  if (a === b) return { match: true, fuzzy: false };
  if (a.includes(b) || b.includes(a)) return { match: true, fuzzy: true };
  const tokensA = new Set(a.split(/[^a-z0-9]+/).filter(Boolean));
  const tokensB = new Set(b.split(/[^a-z0-9]+/).filter(Boolean));
  for (const t of tokensB) {
    if (t.length >= 3 && tokensA.has(t)) return { match: true, fuzzy: true };
  }
  return { match: false, fuzzy: false };
}

function currenciesMatch(requested: string | undefined, payerCurrency: string | undefined, amountSent: string): boolean {
  const req = requested?.trim();
  if (!req) return true;
  const pc = payerCurrency?.trim();
  if (pc && norm(pc) === norm(req)) return true;
  const amt = norm(amountSent);
  if (amt.includes(norm(req))) return true;
  return false;
}

/** Parse first decimal number from a string like "0.5 ETH" or "100.00". */
function parseFirstNumber(s: string): number | null {
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function amountsMatch(expected: number, payerAmountSent: string): { ok: boolean; fuzzy: boolean } {
  const parsed = parseFirstNumber(payerAmountSent);
  if (parsed == null) return { ok: false, fuzzy: false };
  const tol = Math.max(0.02, expected * 0.02);
  if (Math.abs(parsed - expected) <= tol) return { ok: true, fuzzy: false };
  if (Math.abs(parsed - expected) <= expected * 0.1) return { ok: false, fuzzy: true };
  return { ok: false, fuzzy: false };
}

export function buildExplorerUrl(merchantNetwork: string, txHash: string): string | null {
  const h = txHash.trim();
  if (!h) return null;
  const family = detectNetworkFamily(merchantNetwork);
  if (family === 'evm') {
    const n = norm(merchantNetwork);
    if (n.includes('polygon')) return `https://polygonscan.com/tx/${h}`;
    if (n.includes('arbitrum')) return `https://arbiscan.io/tx/${h}`;
    if (n.includes('base')) return `https://basescan.org/tx/${h}`;
    if (n.includes('optimism')) return `https://optimistic.etherscan.io/tx/${h}`;
    if (n.includes('bsc') || n.includes('bnb')) return `https://bscscan.com/tx/${h}`;
    return `https://etherscan.io/tx/${h}`;
  }
  if (family === 'solana') {
    return `https://solscan.io/tx/${h}`;
  }
  if (family === 'bitcoin') {
    return `https://mempool.space/tx/${h.replace(/^0x/i, '')}`;
  }
  return null;
}

export function verifyCryptoConfirmationInput(params: {
  merchantNetwork: string | null | undefined;
  merchantCryptoCurrency: string | null | undefined;
  invoiceAmount: number;
  invoiceCurrency: string;
  payerNetwork: string;
  payerAmountSent: string;
  payerWalletAddress: string;
  payerCurrency?: string | null;
  payerTxHash?: string | null;
}): CryptoVerificationResult {
  const issues: string[] = [];
  let hard = 0;

  const net = params.merchantNetwork?.trim() || '';
  const cur = params.merchantCryptoCurrency?.trim() || '';

  const txCheck = validateTxHashFormat(params.payerTxHash, net);
  if (!txCheck.valid && txCheck.issue) {
    issues.push(txCheck.issue);
    hard += 1;
  }

  if (net) {
    const { match, fuzzy } = networksLooselyMatch(net, params.payerNetwork);
    if (!match) {
      issues.push(`Payer network "${params.payerNetwork}" does not match requested network "${net}"`);
      hard += 1;
    } else if (fuzzy) {
      issues.push(`Network matched loosely — confirm payer used the same chain as "${net}"`);
    }
  }

  if (cur && !currenciesMatch(cur, params.payerCurrency ?? null, params.payerAmountSent)) {
    issues.push(
      `Asset/currency may not match: invoice asks for "${cur}"; payer reported "${params.payerAmountSent}"` +
        (params.payerCurrency ? ` (payer asset: ${params.payerCurrency})` : '')
    );
    hard += 1;
  }

  if (!params.payerWalletAddress?.trim()) {
    issues.push('Payer wallet/source address missing');
    hard += 1;
  }

  const { ok: amtOk, fuzzy: amtFuzzy } = amountsMatch(params.invoiceAmount, params.payerAmountSent);
  if (!amtOk) {
    if (amtFuzzy) {
      issues.push(
        `Reported amount is close but not exact vs invoice ${params.invoiceAmount} ${params.invoiceCurrency} — verify manually`
      );
    } else {
      issues.push(
        `Reported amount does not match invoice total ${params.invoiceAmount} ${params.invoiceCurrency}`
      );
      hard += 1;
    }
  }

  const finalized = finalizeVerification(issues, hard);
  if (finalized.match_confidence === 'LOW' && hard === 0) {
    finalized.verification_issues.push('Overall confidence is low — manual review recommended');
  }
  return finalized;
}
