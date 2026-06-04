/**
 * R4: Hedera mirror manual verify → canonical confirmPayment().
 *
 * providerRef format (idempotency via checkHederaIdempotency):
 *   Normalized Hedera transaction id in mirror dash form: "0.0.{account}-{seconds}-{nanos}"
 *   Raw @ format is accepted as providerRef; confirmPayment normalizes before persistence.
 */
import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  confirmPayment,
  type ConfirmPaymentResult,
} from '@/lib/services/payment-confirmation';
import { generateCorrelationId } from '@/lib/services/correlation';
import { normalizeHederaTransactionId } from '@/lib/hedera/txid';
import type { TokenType } from '@/lib/hedera/constants';
import { TOKEN_CONFIG } from '@/lib/hedera/constants';
import { fromSmallestUnit } from '@/lib/hedera/token-service';
import { hederaMirrorSettlementTrace } from '@/lib/hedera/hedera-mirror-settlement-trace';

export type HederaMirrorNetwork = 'testnet' | 'mainnet';

export interface ExecuteHederaMirrorSettlementParams {
  paymentLinkId: string;
  transactionId: string;
  network: HederaMirrorNetwork;
}

export interface HederaMirrorSettlementDetails {
  tokenType: TokenType;
  amount: number;
  sender: string;
  recipient: string;
  memo?: string;
  consensusTimestamp: string;
  mirrorUrl: string;
}

export type HederaMirrorSettlementResult = ConfirmPaymentResult & {
  correlationId: string;
  normalizedTxId: string;
  settlementDetails?: HederaMirrorSettlementDetails;
};

/**
 * Canonical providerRef for Hedera on-chain settlement (normalized mirror dash format).
 */
export function hederaMirrorSettlementProviderRef(transactionId: string): string {
  return normalizeHederaTransactionId(transactionId);
}

interface MirrorTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  memo_base64?: string;
  result: string;
  transfers?: Array<{
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
  token_transfers?: Array<{
    token_id: string;
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
}

function mirrorBaseUrl(network: HederaMirrorNetwork): string {
  return network === 'mainnet'
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';
}

async function fetchMirrorTransaction(
  normalizedTxId: string,
  network: HederaMirrorNetwork
): Promise<{ tx: MirrorTransaction; mirrorUrl: string } | { error: string }> {
  const mirrorUrl = mirrorBaseUrl(network);
  const txUrl = `${mirrorUrl}/api/v1/transactions/${normalizedTxId}`;
  const maxRetries = 2;
  const retryDelays = [3000, 5000];
  let lastError: Error | null = null;
  let data: { transactions?: MirrorTransaction[] } | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt - 1]));
      }

      const response = await fetch(txUrl, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const jsonData = (await response.json()) as { transactions?: MirrorTransaction[] };
        data = jsonData;
        if (data?.transactions?.length) {
          return { tx: data.transactions[0], mirrorUrl };
        }
        lastError = new Error('Transaction not yet indexed');
      } else if (response.status === 404) {
        lastError = new Error('Transaction not found (not yet indexed)');
      } else {
        lastError = new Error(`Mirror node returned ${response.status}`);
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  return {
    error: lastError?.message || 'Transaction not found on Hedera network after retries',
  };
}

function extractSettlementFromMirrorTx(tx: MirrorTransaction): {
  details: HederaMirrorSettlementDetails;
} | { error: string } {
  const memo = tx.memo_base64
    ? Buffer.from(tx.memo_base64, 'base64').toString('utf-8')
    : undefined;

  let tokenType: TokenType;
  let amount: number;
  let sender: string;
  let recipient: string;

  const hbarTransfer = tx.transfers?.find((t) => t.amount > 0 && !t.is_approval);
  if (hbarTransfer && hbarTransfer.amount > 0) {
    tokenType = 'HBAR';
    amount = fromSmallestUnit(hbarTransfer.amount, 'HBAR');
    recipient = hbarTransfer.account;
    const senderTransfer = tx.transfers?.find((t) => t.amount < 0);
    sender = senderTransfer?.account || 'unknown';
  } else {
    const tokenTransfer = tx.token_transfers?.find((t) => t.amount > 0 && !t.is_approval);
    if (!tokenTransfer) {
      return { error: 'No valid transfer found in transaction' };
    }

    recipient = tokenTransfer.account;
    const tokenId = tokenTransfer.token_id;
    const usdcId = TOKEN_CONFIG.USDC.id;
    const usdtId = TOKEN_CONFIG.USDT.id;
    const auddId = TOKEN_CONFIG.AUDD.id;

    if (tokenId === usdcId) {
      tokenType = 'USDC';
      amount = fromSmallestUnit(tokenTransfer.amount, 'USDC');
    } else if (tokenId === usdtId) {
      tokenType = 'USDT';
      amount = fromSmallestUnit(tokenTransfer.amount, 'USDT');
    } else if (tokenId === auddId) {
      tokenType = 'AUDD';
      amount = fromSmallestUnit(tokenTransfer.amount, 'AUDD');
    } else {
      return { error: `Unknown token ID: ${tokenId}` };
    }

    const senderTransfer = tx.token_transfers?.find(
      (t) => t.token_id === tokenId && t.amount < 0
    );
    sender = senderTransfer?.account || 'unknown';
  }

  return {
    details: {
      tokenType,
      amount,
      sender,
      recipient,
      memo,
      consensusTimestamp: tx.consensus_timestamp,
      mirrorUrl: '',
    },
  };
}

/**
 * Mirror-verified Hedera invoice settlement → confirmPayment (no inline ledger/commission).
 */
export async function executeHederaMirrorSettlement(
  params: ExecuteHederaMirrorSettlementParams
): Promise<HederaMirrorSettlementResult> {
  const normalizedTxId = hederaMirrorSettlementProviderRef(params.transactionId);
  const providerRef = normalizedTxId;
  const correlationId = generateCorrelationId('hedera', normalizedTxId);

  hederaMirrorSettlementTrace('hedera_verify_settlement_started', {
    paymentLinkId: params.paymentLinkId,
    transactionId: params.transactionId,
    transactionHash: normalizedTxId,
    normalizedTxId,
    providerRef,
    network: params.network,
    correlationId,
  });

  try {
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: params.paymentLinkId },
      select: {
        id: true,
        organization_id: true,
        status: true,
        amount: true,
        currency: true,
        invoice_currency: true,
        pilot_deal_id: true,
      },
    });

    if (!paymentLink) {
      const error = 'Payment link not found';
      hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
        paymentLinkId: params.paymentLinkId,
        transactionHash: normalizedTxId,
        providerRef,
        error,
      });
      return { success: false, error, correlationId, normalizedTxId };
    }

    const mirrorResult = await fetchMirrorTransaction(normalizedTxId, params.network);

    if ('error' in mirrorResult) {
      hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
        paymentLinkId: params.paymentLinkId,
        transactionHash: normalizedTxId,
        providerRef,
        error: mirrorResult.error,
      });
      return {
        success: false,
        error: mirrorResult.error,
        correlationId,
        normalizedTxId,
      };
    }

    const { tx, mirrorUrl } = mirrorResult;

    if (tx.result !== 'SUCCESS') {
      const error = `Transaction failed with status: ${tx.result}`;
      hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
        paymentLinkId: params.paymentLinkId,
        transactionHash: normalizedTxId,
        providerRef,
        error,
      });
      return { success: false, error, correlationId, normalizedTxId };
    }

    const extracted = extractSettlementFromMirrorTx(tx);
    if ('error' in extracted) {
      hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
        paymentLinkId: params.paymentLinkId,
        transactionHash: normalizedTxId,
        providerRef,
        error: extracted.error,
      });
      return {
        success: false,
        error: extracted.error,
        correlationId,
        normalizedTxId,
      };
    }

    const { details } = extracted;
    details.mirrorUrl = mirrorUrl;

    if (!details.memo || !details.memo.includes(params.paymentLinkId)) {
      const error = 'Transaction memo does not match this payment link';
      hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
        paymentLinkId: params.paymentLinkId,
        transactionHash: normalizedTxId,
        providerRef,
        error,
        transactionMemo: details.memo,
      });
      return { success: false, error, correlationId, normalizedTxId };
    }

    const confirmResult = await confirmPayment({
      paymentLinkId: params.paymentLinkId,
      provider: 'hedera',
      providerRef,
      transactionId: params.transactionId,
      amountReceived: details.amount,
      currencyReceived: details.tokenType,
      tokenType: details.tokenType,
      correlationId,
      metadata: {
        transactionId: params.transactionId,
        raw_transaction_id: params.transactionId,
        normalized_transaction_id: normalizedTxId,
        amount: details.amount.toString(),
        tokenType: details.tokenType,
        token_type: details.tokenType,
        sender: details.sender,
        recipient: details.recipient,
        consensus_timestamp: details.consensusTimestamp,
        memo: details.memo,
        network: params.network,
        mirror_url: mirrorUrl,
        payer_account_id: details.sender,
        merchant_account_id: details.recipient,
        manuallyVerified: true,
        settlementPath: 'hedera_mirror_verify',
        source: 'hedera-manual-verify',
      },
    });

    if (!confirmResult.success) {
      hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
        paymentLinkId: params.paymentLinkId,
        transactionHash: normalizedTxId,
        providerRef,
        error: confirmResult.error,
      });
      return {
        ...confirmResult,
        correlationId,
        normalizedTxId,
        settlementDetails: details,
      };
    }

    hederaMirrorSettlementTrace('hedera_verify_settlement_completed', {
      paymentLinkId: params.paymentLinkId,
      transactionHash: normalizedTxId,
      providerRef,
      paymentEventId: confirmResult.paymentEventId,
      alreadyProcessed: confirmResult.alreadyProcessed,
      correlationId,
    });

    return {
      ...confirmResult,
      correlationId,
      normalizedTxId,
      settlementDetails: details,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    hederaMirrorSettlementTrace('hedera_verify_settlement_failed', {
      paymentLinkId: params.paymentLinkId,
      transactionHash: normalizedTxId,
      providerRef,
      error: message,
    });
    return { success: false, error: message, correlationId, normalizedTxId };
  }
}
