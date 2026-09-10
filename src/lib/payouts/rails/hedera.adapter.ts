import Long from 'long';
import { AccountId, TransactionId, TransferTransaction } from '@hashgraph/sdk';
import { CURRENT_NETWORK, CURRENT_NODE_ACCOUNT_ID } from '@/lib/hedera/constants';
import { fromSmallestUnit, toSmallestUnit } from '@/lib/hedera/amount-utils';
import { getPayoutTokenForCurrency } from '@/lib/hedera/tokens';
import { getPayoutRail } from '@/lib/payouts/rails/registry';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import type {
  CanonicalPayoutEvent,
  CanonicalPayoutInstruction,
  CanonicalPayoutStatus,
  PayoutAdapterSubmitResult,
  PayoutQuote,
  PayoutRailAdapter,
  PayoutRailExecutionContext,
  PreparedPayout,
} from '@/lib/payouts/rails/types';

const MIRROR_URL =
  CURRENT_NETWORK === 'mainnet'
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';

export type HederaPreparePayee = {
  payoutId: string;
  userId: string;
  hederaAccountId: string;
  netAmount: string;
};

export type HederaTransferPlan = {
  payees: HederaPreparePayee[];
  missingPayeeUserIds: string[];
  tokenSymbol: string;
  tokenId: string;
  decimals: number;
};

export function hederaPayoutProviderReference(transactionId: string): string {
  const trimmed = transactionId.replace(/^hedera:/, '');
  return `hedera:${trimmed.replace('@', '-')}`;
}

export function selectHederaPreparePayees(
  instructions: CanonicalPayoutInstruction[],
  destinationsByPayoutId: Record<string, string | null | undefined>
): { payees: HederaPreparePayee[]; missingPayeeUserIds: string[] } {
  const payees: HederaPreparePayee[] = [];
  const missingPayeeUserIds: string[] = [];

  for (const instruction of instructions) {
    if (instruction.railId !== 'hedera') continue;
    if (instruction.status === 'PAID' || instruction.status === 'FAILED') continue;
    const hederaId = destinationsByPayoutId[instruction.payoutId]?.trim();
    if (!hederaId) {
      missingPayeeUserIds.push(instruction.payeeUserId);
      continue;
    }
    payees.push({
      payoutId: instruction.payoutId,
      userId: instruction.payeeUserId,
      hederaAccountId: hederaId,
      netAmount: instruction.amount,
    });
  }

  return { payees, missingPayeeUserIds };
}

export function buildHederaTransferPlan(
  instructions: CanonicalPayoutInstruction[],
  context: PayoutRailExecutionContext,
  currency: string
): HederaTransferPlan {
  const tokenInfo = getPayoutTokenForCurrency(currency);
  if (!tokenInfo?.tokenId) {
    throw new PayoutReleaseError(
      'HEDERA_CURRENCY_UNSUPPORTED',
      `Currency ${currency} is not supported for on-chain payout. Supported: USD/USDC → USDC, AUD/AUDD → AUDD.`
    );
  }

  const { payees, missingPayeeUserIds } = selectHederaPreparePayees(
    instructions,
    context.hederaDestinationsByPayoutId ?? {}
  );

  return {
    payees,
    missingPayeeUserIds,
    tokenSymbol: tokenInfo.symbol,
    tokenId: tokenInfo.tokenId,
    decimals: tokenInfo.decimals,
  };
}

export type HederaMirrorSyncResult = {
  ok: boolean;
  result: string | null;
  providerReference: string;
  httpStatus?: number;
};

export async function syncHederaMirrorTransaction(
  transactionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<HederaMirrorSyncResult> {
  const normalizedTxId = transactionId.replace(/^hedera:/, '').replace('@', '-');
  const providerReference = hederaPayoutProviderReference(normalizedTxId);
  const txUrl = `${MIRROR_URL}/api/v1/transactions/${normalizedTxId}`;
  const res = await fetchImpl(txUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    return {
      ok: false,
      result: null,
      providerReference,
      httpStatus: res.status,
    };
  }
  const data = (await res.json()) as { transactions?: Array<{ result: string }> };
  const mirrorTx = data.transactions?.[0];
  if (!mirrorTx || mirrorTx.result !== 'SUCCESS') {
    return {
      ok: false,
      result: mirrorTx?.result ?? null,
      providerReference,
    };
  }
  return { ok: true, result: 'SUCCESS', providerReference };
}

export function hederaPaidEvents(input: {
  payoutIds: string[];
  providerReference: string;
  paidAt?: Date;
}): CanonicalPayoutEvent[] {
  return input.payoutIds.map((payoutId) => ({
    payoutId,
    railId: 'hedera' as const,
    providerReference: input.providerReference,
    status: 'PAID' as const,
    occurredAt: input.paidAt,
  }));
}

async function freezeHederaTransfer(input: {
  plan: HederaTransferPlan;
  merchantAccountId: string;
  batchId: string;
}): Promise<PreparedPayout> {
  const transferTx = new TransferTransaction().setNodeAccountIds([
    AccountId.fromString(CURRENT_NODE_ACCOUNT_ID),
  ]);

  const includedPayees: HederaPreparePayee[] = [];
  const includedPayoutIds: string[] = [];
  let totalSmallest = BigInt(0);

  for (const payee of input.plan.payees) {
    let small: bigint;
    try {
      small = toSmallestUnit(payee.netAmount, input.plan.decimals);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid amount';
      throw new PayoutReleaseError('HEDERA_INVALID_AMOUNT', `Invalid payout amount for payee: ${msg}`);
    }
    if (small === BigInt(0)) continue;
    totalSmallest += small;
    includedPayees.push(payee);
    includedPayoutIds.push(payee.payoutId);
    transferTx.addTokenTransfer(
      input.plan.tokenId,
      AccountId.fromString(payee.hederaAccountId),
      Long.fromString(small.toString())
    );
  }

  if (includedPayees.length === 0 || totalSmallest === BigInt(0)) {
    throw new PayoutReleaseError(
      'HEDERA_NOTHING_TO_PAY',
      'Nothing to pay (all payee amounts are zero)'
    );
  }

  transferTx.addTokenTransfer(
    input.plan.tokenId,
    AccountId.fromString(input.merchantAccountId),
    Long.fromString(totalSmallest.toString()).negate()
  );
  transferTx.setTransactionMemo(`Provvypay payout batch ${input.batchId}`);

  const txId = TransactionId.generate(AccountId.fromString(input.merchantAccountId));
  transferTx.setTransactionId(txId);

  const frozen = transferTx.freeze();
  const transactionBase64 = Buffer.from(frozen.toBytes()).toString('base64');

  return {
    railId: 'hedera',
    payoutIds: includedPayoutIds,
    providerPayload: {
      transactionBase64,
      merchantAccountId: input.merchantAccountId,
      summary: includedPayees.map((p) => ({
        userId: p.userId,
        hederaAccountId: p.hederaAccountId,
        amount: p.netAmount,
        symbol: input.plan.tokenSymbol,
      })),
      includedPayoutIds,
      totalAmount: fromSmallestUnit(totalSmallest, input.plan.decimals),
      totalSmallestUnit: totalSmallest.toString(),
      decimals: input.plan.decimals,
      tokenSymbol: input.plan.tokenSymbol,
      tokenId: input.plan.tokenId,
      batchId: input.batchId,
      payeeCount: includedPayees.length,
    },
  };
}

async function prepareHederaGroup(
  instructions: CanonicalPayoutInstruction[],
  context?: PayoutRailExecutionContext
): Promise<PreparedPayout> {
  const merchantAccountId = context?.merchantHederaAccountId?.trim();
  if (!merchantAccountId) {
    throw new PayoutReleaseError(
      'HEDERA_MERCHANT_MISSING',
      'Merchant Hedera account not configured. Set hedera_account_id in merchant settings.'
    );
  }
  if (instructions.length === 0) {
    throw new PayoutReleaseError('HEDERA_NO_PAYOUTS', 'No Hedera payouts to prepare');
  }

  const currency = instructions[0]?.currency ?? '';
  const plan = buildHederaTransferPlan(instructions, context ?? {}, currency);

  if (plan.missingPayeeUserIds.length > 0) {
    throw new PayoutReleaseError(
      'HEDERA_DESTINATION_MISSING',
      'Some payees do not have a Hedera payout destination (method_type must be HEDERA)',
      400,
      { missingPayeeUserIds: plan.missingPayeeUserIds }
    );
  }
  if (plan.payees.length === 0) {
    throw new PayoutReleaseError(
      'HEDERA_NO_UNPAID',
      'No unpaid Hedera payouts in this batch or all payouts already paid'
    );
  }

  return freezeHederaTransfer({
    plan,
    merchantAccountId,
    batchId: instructions[0].batchId,
  });
}

export function hederaDestinationsByPayoutId(
  rows: Array<{ id: string; payout_methods: { hedera_account_id: string | null } | null }>
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const row of rows) {
    out[row.id] = row.payout_methods?.hedera_account_id ?? null;
  }
  return out;
}

export const HederaPayoutRailAdapter: PayoutRailAdapter = {
  railId: 'hedera',

  getCapabilities() {
    return getPayoutRail('hedera');
  },

  async quote(instruction: CanonicalPayoutInstruction): Promise<PayoutQuote> {
    return {
      railId: 'hedera',
      feeAmount: '0',
      feeCurrency: instruction.currency,
      estimatedSettlementHint: getPayoutRail('hedera').typicalSettlementHint,
      raw: null,
    };
  },

  async prepare(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PreparedPayout> {
    return prepareHederaGroup([instruction], context);
  },

  prepareGroup: prepareHederaGroup,

  async submit(
    instruction: CanonicalPayoutInstruction,
    _context?: PayoutRailExecutionContext
  ): Promise<PayoutAdapterSubmitResult> {
    return {
      providerReference: instruction.providerReference,
      status: 'PROCESSING',
    };
  },

  async syncStatus(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<CanonicalPayoutStatus> {
    const txId = instruction.providerReference?.replace(/^hedera:/, '') ?? null;
    if (!txId) {
      return { status: instruction.status === 'PAID' ? 'PAID' : 'PROCESSING', providerReference: null };
    }
    const mirror = await syncHederaMirrorTransaction(txId, context?.fetchImpl ?? fetch);
    if (!mirror.ok) {
      return {
        status: 'PROCESSING',
        providerReference: mirror.providerReference,
        failedReason: mirror.result ? `Transaction failed with result: ${mirror.result}` : 'Transaction not found',
      };
    }
    return { status: 'PAID', providerReference: mirror.providerReference };
  },

  normalizeWebhook(_raw: unknown): CanonicalPayoutEvent | null {
    return null;
  },
};
