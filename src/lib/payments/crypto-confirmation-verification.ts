/**
 * Assisted verification for manual crypto payment confirmations (Payment Links only).
 * Heuristic checks — not on-chain proof.
 */

import type { CryptoVerificationStatus, MatchConfidence } from '@prisma/client';
import {
  isAssetSupportedOnNetwork,
  networkFamily,
  normalizeNetworkName,
} from '@/lib/payments/canonical-networks';
import { finalizeVerification } from '@/lib/payments/manual-confirmation-verification';

export type CryptoVerificationResult = {
  verification_status: CryptoVerificationStatus;
  match_confidence: MatchConfidence;
  verification_issues: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalize tx hash — strip explorer URLs, lowercase EVM prefix. */
export function normalizeTxHash(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let h = raw.trim();
  if (!h) return null;
  const urlMatch = h.match(/\/(?:tx|transaction)\/([a-zA-Z0-9]+)/i);
  if (urlMatch?.[1]) h = urlMatch[1];
  if (/^0x[a-fA-F0-9]+$/i.test(h)) return h.toLowerCase();
  return h;
}

function detectNetworkFamily(merchantNetwork: string): 'evm' | 'solana' | 'bitcoin' | 'hedera' | 'tron' | 'unknown' {
  return networkFamily(merchantNetwork);
}

export function isLikelyEvmTxHash(hash: string): boolean {
  const h = hash.trim();
  return /^0x[a-fA-F0-9]{64}$/.test(h);
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,100}$/;

export function isLikelySolanaTxSig(sig: string): boolean {
  const s = sig.trim();
  return BASE58.test(s) && s.length >= 80 && s.length <= 90;
}

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
  const h = normalizeTxHash(txHash) ?? txHash.trim();
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
  if (family === 'hedera') {
    if (!/^\d+\.\d+\.\d+@\d+\.\d+$/.test(h) && h.length < 16) {
      return { valid: false, issue: 'Transaction id does not match typical Hedera format' };
    }
    return { valid: true };
  }
  if (h.length < 16) {
    return { valid: false, issue: 'Transaction hash looks too short for a typical on-chain id' };
  }
  return { valid: true };
}

function validateWalletFormat(
  wallet: string,
  network: string
): { valid: boolean; issue?: string } {
  const w = wallet.trim();
  if (!w) return { valid: false, issue: 'Payer wallet/source address missing' };
  const family = detectNetworkFamily(network);

  if (family === 'evm') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(w)) {
      return { valid: false, issue: 'Wallet address does not match EVM format (0x + 40 hex)' };
    }
  }
  if (family === 'hedera') {
    if (!/^0\.0\.\d+$/.test(w)) {
      return { valid: false, issue: 'Wallet address does not match Hedera account format (0.0.xxxxx)' };
    }
  }
  if (family === 'bitcoin') {
    if (w.length < 26 || w.length > 90) {
      return { valid: false, issue: 'Wallet address does not match typical Bitcoin address length' };
    }
  }
  return { valid: true };
}

function networksLooselyMatch(requested: string, payer: string): { match: boolean; fuzzy: boolean } {
  const a = norm(normalizeNetworkName(requested));
  const b = norm(normalizeNetworkName(payer));
  if (a === b) return { match: true, fuzzy: false };
  if (a.includes(b) || b.includes(a)) return { match: true, fuzzy: true };
  return { match: false, fuzzy: false };
}

function currenciesMatch(
  requested: string | undefined,
  payerCurrency: string | undefined,
  amountSent: string
): boolean {
  const req = requested?.trim();
  if (!req) return true;
  const pc = payerCurrency?.trim();
  if (pc && norm(pc) === norm(req)) return true;
  const amt = norm(amountSent);
  if (amt.includes(norm(req))) return true;
  return false;
}

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
  const h = (normalizeTxHash(txHash) ?? txHash).trim();
  if (!h) return null;
  const family = detectNetworkFamily(merchantNetwork);
  const n = norm(normalizeNetworkName(merchantNetwork));
  if (family === 'evm') {
    if (n.includes('polygon')) return `https://polygonscan.com/tx/${h}`;
    if (n.includes('arbitrum')) return `https://arbiscan.io/tx/${h}`;
    if (n.includes('base')) return `https://basescan.org/tx/${h}`;
    if (n.includes('optimism')) return `https://optimistic.etherscan.io/tx/${h}`;
    if (n.includes('bnb')) return `https://bscscan.com/tx/${h}`;
    return `https://etherscan.io/tx/${h}`;
  }
  if (family === 'solana') {
    return `https://solscan.io/tx/${h}`;
  }
  if (family === 'bitcoin') {
    return `https://mempool.space/tx/${h.replace(/^0x/i, '')}`;
  }
  if (family === 'hedera') {
    return `https://hashscan.io/mainnet/transaction/${encodeURIComponent(h)}`;
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

  const net = normalizeNetworkName(params.merchantNetwork?.trim() || '');
  const cur = params.merchantCryptoCurrency?.trim() || '';
  const payerNet = normalizeNetworkName(params.payerNetwork);
  const payerAsset = params.payerCurrency?.trim() || cur;

  // Merchant-configured network + asset compatibility
  if (net && cur) {
    const merchantCompat = isAssetSupportedOnNetwork(net, cur);
    if (!merchantCompat.supported && merchantCompat.reason) {
      issues.push(merchantCompat.reason);
      hard += 1;
    }
  }

  // Payer-reported network + asset compatibility
  if (payerNet && payerAsset) {
    const payerCompat = isAssetSupportedOnNetwork(payerNet, payerAsset);
    if (!payerCompat.supported && payerCompat.reason) {
      issues.push(payerCompat.reason);
      hard += 1;
    }
  }

  const normalizedHash = normalizeTxHash(params.payerTxHash);
  const txCheck = validateTxHashFormat(normalizedHash ?? params.payerTxHash, net || payerNet);
  if (!txCheck.valid && txCheck.issue) {
    issues.push(txCheck.issue);
    hard += 1;
  }

  if (net) {
    const { match, fuzzy } = networksLooselyMatch(net, params.payerNetwork);
    if (!match) {
      issues.push(`Payer network "${payerNet}" does not match requested network "${net}"`);
      hard += 1;
    } else if (fuzzy) {
      issues.push(`Network matched loosely — confirm payer used the same chain as "${net}"`);
    }
  }

  if (cur && !currenciesMatch(cur, params.payerCurrency ?? null, params.payerAmountSent)) {
    issues.push(
      `Asset/currency mismatch: invoice asks for "${cur}"; payer reported "${params.payerAmountSent}"` +
        (params.payerCurrency ? ` (payer asset: ${params.payerCurrency})` : '')
    );
    hard += 1;
  }

  const walletCheck = validateWalletFormat(params.payerWalletAddress, net || payerNet);
  if (!walletCheck.valid && walletCheck.issue) {
    issues.push(walletCheck.issue);
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
  if (finalized.match_confidence === 'HIGH' && issues.length > 0) {
    finalized.match_confidence = 'MEDIUM';
  }
  if (hard > 0) {
    finalized.verification_status = 'FLAGGED';
    finalized.match_confidence = 'LOW';
  }
  return finalized;
}
