import {
  cregisCurrencyInProjectCoins,
  type CregisProjectCoin,
} from '@/lib/payouts/rails/cregis-coins';
import {
  findCregisCurrencyByAssetNetwork,
  normalizeCregisNetwork,
  resolveCregisDestination,
  resolveCregisSubmitAmount,
} from '@/lib/payouts/rails/cregis-currency';

export type CregisConnectionSnapshot = {
  connected: boolean;
  hasApiKey: boolean;
  hasGateway: boolean;
  pid: number | null;
  environment: 'sandbox' | 'production' | null;
  connectionExecutionEnabled: boolean;
  effectiveExecutionEnabled: boolean;
  gatewayLooksProduction: boolean | null;
};

export type CregisPayoutReadiness = {
  eligible: boolean;
  executable: boolean;
  rail: 'cregis';
  reasons: string[];
  destination: {
    asset: string | null;
    network: string | null;
    addressPresent: boolean;
  };
  settlement: {
    currency: string | null;
    tokenAmount: string | null;
    tokenAmountKnown: boolean;
  };
  provider: {
    configured: boolean;
    environment: 'sandbox' | 'production' | null;
    supportedCurrency: boolean | null;
    pidPresent: boolean;
    gatewayPresent: boolean;
    credentialsPresent: boolean;
    executionEnabled: boolean;
    productionExecutionEnabled: boolean;
    platformEnabled: boolean;
    gatewayLooksProduction: boolean | null;
  };
  endpointsCalled: string[];
  projectCoins: CregisProjectCoin[] | null;
};

function readDetailString(
  details: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!details) return null;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function isCregisConnectionSelectable(
  connection: CregisConnectionSnapshot,
  productionEnabled: boolean
): boolean {
  if (!connection.connected || !connection.hasApiKey || !connection.hasGateway || connection.pid == null) {
    return false;
  }
  if (connection.gatewayLooksProduction === true) {
    return connection.environment === 'production' && productionEnabled;
  }
  if (connection.environment === 'production') {
    return productionEnabled;
  }
  return true;
}

export function evaluateCregisPayoutReadiness(input: {
  connection: CregisConnectionSnapshot;
  methodType?: string | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string | null;
  payoutCurrency?: string | null;
  projectCoins?: CregisProjectCoin[] | null;
  coinsQueryError?: string | null;
  endpointsCalled?: string[];
  platformEnabled?: boolean;
  productionEnabled?: boolean;
}): CregisPayoutReadiness {
  const reasons: string[] = [];
  const platformEnabled =
    input.platformEnabled ?? process.env.CREGIS_PAYOUTS_ENABLED === 'true';
  const productionEnabled =
    input.productionEnabled ?? process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED === 'true';
  const connection = input.connection;
  const details = input.destinationDetails ?? null;
  const asset =
    readDetailString(details, ['asset', 'token', 'tokenSymbol'])?.toUpperCase() ?? null;
  const network = normalizeCregisNetwork(
    readDetailString(details, ['network', 'chain', 'chainName'])
  );
  const addressPresent = Boolean(
    readDetailString(details, ['address', 'walletAddress', 'toAddress', 'to_address']) ||
      input.destinationHandle?.trim()
  );

  if (!connection.connected) reasons.push('Cregis connection does not exist');
  if (connection.pid == null) reasons.push('pid is missing');
  if (!connection.hasGateway) reasons.push('Gateway URL is missing');
  if (!connection.hasApiKey) reasons.push('API credentials are missing');

  if (connection.environment === 'production' && !productionEnabled) {
    reasons.push('Environment is production while CREGIS_PRODUCTION_PAYOUTS_ENABLED is not true');
  }
  if (connection.gatewayLooksProduction === true && connection.environment !== 'production') {
    reasons.push('Gateway URL appears to be production rather than sandbox/test');
  }
  if (connection.gatewayLooksProduction === true && !productionEnabled) {
    reasons.push('Gateway URL appears to be production and production execution is disabled');
  }
  if (connection.environment && connection.environment !== 'sandbox' && connection.environment !== 'production') {
    reasons.push('Cregis environment is not sandbox or production');
  }

  const providerConfigured = Boolean(
    connection.connected && connection.hasApiKey && connection.hasGateway && connection.pid != null
  );
  const selectable = isCregisConnectionSelectable(connection, productionEnabled);

  if (input.methodType === 'HEDERA') {
    reasons.push('Hedera destinations use the Hedera rail, not Cregis');
  } else if (input.methodType && input.methodType !== 'CRYPTO') {
    reasons.push('Destination is not a CRYPTO wallet');
  }

  if (input.methodType === 'CRYPTO' || !input.methodType) {
    if (!addressPresent) reasons.push('Wallet address is missing');
    if (!asset) reasons.push('Asset is missing');
    if (!network) reasons.push('Network is missing');
  }

  const mapped =
    input.methodType === 'HEDERA'
      ? null
      : resolveCregisDestination({
          handle: input.destinationHandle,
          details,
        });
  if (!mapped && (asset || network) && !findCregisCurrencyByAssetNetwork(asset, network)) {
    reasons.push('Asset/network cannot be mapped to a Cregis currency identifier');
  } else if (!mapped && input.methodType === 'CRYPTO' && addressPresent && asset && network) {
    reasons.push('Asset/network cannot be mapped to a Cregis currency identifier');
  }

  const payoutCurrency = input.payoutCurrency?.trim().toUpperCase() ?? null;
  const payoutAmount = input.payoutAmount?.trim() || null;
  const amount = mapped
    ? resolveCregisSubmitAmount({
        payoutAmount: payoutAmount ?? '',
        payoutCurrency: payoutCurrency ?? '',
        details,
        record: mapped.record,
      })
    : null;

  if (mapped && !amount) {
    if (payoutCurrency === 'AUD' && (mapped.record.asset === 'USDT' || mapped.record.asset === 'USDC')) {
      reasons.push('AUD → USDT/USDC is not eligible under current policy without an explicit token amount');
    } else if (payoutCurrency === 'USD' && mapped.record.asset !== 'USDT' && mapped.record.asset !== 'USDC') {
      reasons.push('Unsupported crypto denomination: USD amount cannot be sent as this asset without inventing FX');
    } else {
      reasons.push('Token amount cannot be determined without inventing FX');
    }
  }

  let supportedCurrency: boolean | null = null;
  if (input.coinsQueryError) {
    reasons.push(`Project coins query failed: ${input.coinsQueryError}`);
  } else if (input.projectCoins && mapped) {
    supportedCurrency = cregisCurrencyInProjectCoins(input.projectCoins, mapped.currency);
    if (!supportedCurrency) {
      reasons.push('Project payout_coins does not include this currency');
    }
  }

  if (!connection.connectionExecutionEnabled) {
    reasons.push('Organization Cregis executionEnabled is false');
  }
  if (!platformEnabled) {
    reasons.push('CREGIS_PAYOUTS_ENABLED is not true');
  }

  const destinationReady = Boolean(
    mapped &&
      addressPresent &&
      input.methodType !== 'HEDERA' &&
      (input.methodType == null || input.methodType === 'CRYPTO')
  );
  const settlementReady = Boolean(amount);
  const projectCurrencyOk = supportedCurrency !== false && !input.coinsQueryError;
  const eligible =
    selectable && destinationReady && settlementReady && projectCurrencyOk && mapped != null;
  const executable =
    eligible &&
    connection.connectionExecutionEnabled &&
    connection.effectiveExecutionEnabled &&
    platformEnabled &&
    (connection.environment !== 'production' || productionEnabled);

  return {
    eligible,
    executable,
    rail: 'cregis',
    reasons: [...new Set(reasons)],
    destination: {
      asset,
      network,
      addressPresent,
    },
    settlement: {
      currency: mapped?.currency ?? null,
      tokenAmount: amount?.amount ?? null,
      tokenAmountKnown: Boolean(amount),
    },
    provider: {
      configured: providerConfigured,
      environment: connection.environment,
      supportedCurrency,
      pidPresent: connection.pid != null,
      gatewayPresent: connection.hasGateway,
      credentialsPresent: connection.hasApiKey,
      executionEnabled: connection.connectionExecutionEnabled,
      productionExecutionEnabled: productionEnabled,
      platformEnabled,
      gatewayLooksProduction: connection.gatewayLooksProduction,
    },
    endpointsCalled: input.endpointsCalled ?? [],
    projectCoins: input.projectCoins ?? null,
  };
}
