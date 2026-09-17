import 'server-only';

import {
  createPublicClient,
  getAddress,
  http,
  parseEventLogs,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import {
  XLAYER_TESTNET_CHAIN_ID,
  buildXlayerExplorerTxUrl,
  getConfiguredRegistryAddress,
  getXlayerRpcUrl,
  xLayerTestnet,
} from '@/lib/xlayer/chain';
import { commitmentRegistryAbi } from '@/lib/xlayer/commitment-registry.abi';
import {
  getCommitmentById,
  saveVerificationResult,
  writeCommitmentAudit,
} from '@/lib/xlayer/store.server';
import { stringToBytes32 } from '@/lib/xlayer/terms-hash';
import type { OnchainVerificationStatus, XlayerCommitmentRecord } from '@/lib/xlayer/types';

export type RegisteredCommitmentLog = {
  args: {
    commitmentId: Hex;
    creator: `0x${string}`;
    termsHash?: Hex;
    amountMinorUnits?: bigint;
  };
};

export type XlayerVerifyDeps = {
  getPublicClient?: () => PublicClient;
  parseRegisteredLogs?: (input: {
    abi: typeof commitmentRegistryAbi;
    logs: TransactionReceipt['logs'];
    eventName: 'CommitmentRegistered';
  }) => readonly RegisteredCommitmentLog[];
};

function defaultPublicClient(): PublicClient {
  return createPublicClient({
    chain: xLayerTestnet,
    transport: http(getXlayerRpcUrl()),
  });
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function readReceipt(
  client: PublicClient,
  transactionHash: Hash,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<TransactionReceipt | null> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const intervalMs = options?.intervalMs ?? 3_000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await client.getTransactionReceipt({ hash: transactionHash });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return null;
}

export async function verifyXlayerCommitment(
  input: {
    organizationId: string;
    userId: string;
    id: string;
  },
  deps: XlayerVerifyDeps = {}
): Promise<XlayerCommitmentRecord> {
  const existing = await getCommitmentById(input);
  if (!existing) {
    throw Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND', status: 404 });
  }
  if (!existing.transactionHash) {
    throw Object.assign(new Error('Commitment has no transaction hash to verify'), {
      code: 'MISSING_TX',
      status: 409,
    });
  }
  if (existing.verificationStatus === 'verified') {
    return existing;
  }

  const registry = getConfiguredRegistryAddress();
  if (!registry) {
    throw Object.assign(new Error('X Layer registry is not configured'), {
      code: 'NOT_CONFIGURED',
      status: 409,
    });
  }

  await saveVerificationResult({
    organizationId: input.organizationId,
    id: input.id,
    verificationStatus: 'confirming',
  });

  const client = deps.getPublicClient?.() ?? defaultPublicClient();
  const receipt = await readReceipt(client, existing.transactionHash as Hash, {
    maxAttempts: deps.getPublicClient ? 1 : 30,
    intervalMs: deps.getPublicClient ? 0 : 3_000,
  });

  const fail = async (status: OnchainVerificationStatus) => {
    const next = await saveVerificationResult({
      organizationId: input.organizationId,
      id: input.id,
      verificationStatus: status,
      onchainStatus: null,
      explorerUrl: null,
    });
    if (existing.verificationStatus !== status) {
      await writeCommitmentAudit({
        organizationId: input.organizationId,
        userId: input.userId,
        entityId: existing.id,
        action: status,
        values: { transactionHash: existing.transactionHash },
      });
    }
    return next;
  };

  if (!receipt) return fail('failed');
  if (receipt.status !== 'success') return fail('failed');
  if (!receipt.to || getAddress(receipt.to) !== getAddress(registry)) return fail('mismatch');

  const registered = (deps.parseRegisteredLogs ?? ((input) =>
    parseEventLogs({
      abi: input.abi,
      logs: input.logs,
      eventName: input.eventName,
    })
  ))({
    abi: commitmentRegistryAbi,
    logs: receipt.logs,
    eventName: 'CommitmentRegistered',
  });
  const event = registered.find((entry) =>
    sameHex(entry.args.commitmentId, existing.onchainCommitmentId)
  );
  if (!event) return fail('mismatch');
  if (!existing.walletAddress || getAddress(event.args.creator) !== getAddress(existing.walletAddress)) {
    return fail('mismatch');
  }

  const onchain = await client.readContract({
    address: registry,
    abi: commitmentRegistryAbi,
    functionName: 'getCommitment',
    args: [existing.onchainCommitmentId as Hex],
  });

  const expectedDue = existing.dueDate ? Math.floor(new Date(existing.dueDate).getTime() / 1000) : 0;
  const matches =
    sameHex(onchain.commitmentId, existing.onchainCommitmentId) &&
    onchain.amountMinorUnits === BigInt(existing.amountMinorUnits) &&
    sameHex(onchain.sourceCurrency, stringToBytes32(existing.sourceCurrency)) &&
    sameHex(onchain.settlementCurrency, stringToBytes32(existing.settlementCurrency)) &&
    Number(onchain.dueDate) === expectedDue &&
    sameHex(onchain.purposeHash, existing.registerArgs.purposeHash) &&
    sameHex(onchain.termsHash, existing.termsHash);

  if (!matches) return fail('mismatch');

  const verified = await saveVerificationResult({
    organizationId: input.organizationId,
    id: input.id,
    verificationStatus: 'verified',
    onchainStatus: 'registered',
    blockNumber: receipt.blockNumber,
    explorerUrl: buildXlayerExplorerTxUrl(existing.transactionHash),
  });
  await writeCommitmentAudit({
    organizationId: input.organizationId,
    userId: input.userId,
    entityId: existing.id,
    action: 'verified',
    values: {
      transactionHash: existing.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      chainId: XLAYER_TESTNET_CHAIN_ID,
    },
  });
  return verified;
}
