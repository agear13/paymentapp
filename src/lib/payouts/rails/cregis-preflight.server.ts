import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { queryCregisProjectCoins } from '@/lib/payouts/rails/cregis-coins';
import { evaluateCregisPayoutReadiness, type CregisPayoutReadiness } from '@/lib/payouts/rails/cregis-preflight';
import {
  getCregisConnection,
  inspectCregisConnection,
} from '@/lib/payouts/rails/cregis-connection.server';

function asDetails(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function preflightCregisPayout(input: {
  organizationId: string;
  payoutId?: string;
  methodType?: string | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string | null;
  payoutCurrency?: string | null;
  queryProjectCoins?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<CregisPayoutReadiness> {
  let methodType = input.methodType ?? null;
  let destinationHandle = input.destinationHandle ?? null;
  let destinationDetails = input.destinationDetails ?? null;
  let payoutAmount = input.payoutAmount ?? null;
  let payoutCurrency = input.payoutCurrency ?? null;

  if (input.payoutId) {
    const payout = await prisma.payouts.findFirst({
      where: { id: input.payoutId, organization_id: input.organizationId },
      include: {
        payout_methods: {
          select: { method_type: true, handle: true, details: true },
        },
      },
    });
    if (payout) {
      methodType = methodType ?? payout.payout_methods?.method_type ?? null;
      destinationHandle = destinationHandle ?? payout.payout_methods?.handle ?? null;
      destinationDetails = destinationDetails ?? asDetails(payout.payout_methods?.details);
      payoutAmount = payoutAmount ?? payout.net_amount.toString();
      payoutCurrency = payoutCurrency ?? payout.currency;
    }
  }

  const connection = await inspectCregisConnection(input.organizationId);
  const queryProjectCoins = input.queryProjectCoins !== false && connection.hasApiKey;
  const endpointsCalled: string[] = [];
  let projectCoins = null;
  let coinsQueryError: string | null = null;

  if (queryProjectCoins) {
    const credentials = await getCregisConnection(input.organizationId);
    if (credentials?.apiKey && credentials.gatewayBaseUrl) {
      try {
        const coins = await queryCregisProjectCoins(credentials, input.fetchImpl);
        endpointsCalled.push('/api/v1/coins');
        projectCoins = coins.payoutCoins;
      } catch (error) {
        coinsQueryError = error instanceof Error ? error.message : 'Cregis coins query failed';
        endpointsCalled.push('/api/v1/coins');
      }
    }
  }

  return evaluateCregisPayoutReadiness({
    connection,
    methodType,
    destinationHandle,
    destinationDetails,
    payoutAmount,
    payoutCurrency,
    projectCoins,
    coinsQueryError,
    endpointsCalled,
  });
}
