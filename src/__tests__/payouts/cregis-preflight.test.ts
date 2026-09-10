import fs from 'node:fs';
import path from 'node:path';
import { CREGIS_COINS_PATH, queryCregisProjectCoins } from '@/lib/payouts/rails/cregis-coins';
import { assessCregisGatewayLooksProduction } from '@/lib/payouts/rails/cregis-gateway';
import {
  evaluateCregisPayoutReadiness,
  isCregisConnectionSelectable,
  type CregisConnectionSnapshot,
} from '@/lib/payouts/rails/cregis-preflight';
import { buildPayoutRailCreateFields } from '@/lib/payouts/stamp-payout-rail';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';
import { payoutIdempotencyKey } from '@/lib/payouts/payout-idempotency';
import { CREGIS_PAYOUT_CREATE_PATH } from '@/lib/payouts/rails/cregis.adapter';

const USDT_TRON = {
  methodType: 'CRYPTO' as const,
  destinationHandle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
  destinationDetails: {
    address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
    asset: 'USDT',
    network: 'tron',
  },
  payoutAmount: '25',
  payoutCurrency: 'USD',
};

const USDT_TRON_COIN = {
  coinName: 'USDT-TRC20',
  chainId: '195',
  tokenId: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
};

function sandboxConnection(
  overrides: Partial<CregisConnectionSnapshot> = {}
): CregisConnectionSnapshot {
  return {
    connected: true,
    hasApiKey: true,
    hasGateway: true,
    pid: 1382528827416576,
    environment: 'sandbox',
    connectionExecutionEnabled: false,
    effectiveExecutionEnabled: false,
    gatewayLooksProduction: false,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Cregis gateway classification', () => {
  it('does not assume an unknown project gateway is production or sandbox', () => {
    expect(assessCregisGatewayLooksProduction('https://gateway.cregis.example/app')).toBeNull();
    expect(assessCregisGatewayLooksProduction('https://prod.cregis.example')).toBe(true);
    expect(assessCregisGatewayLooksProduction('https://sandbox.cregis.example')).toBe(false);
  });
});

describe('Cregis preflight readiness', () => {
  it('marks a valid sandbox CRYPTO destination eligible but not executable when gates are off', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection(),
      ...USDT_TRON,
      platformEnabled: false,
      productionEnabled: false,
    });
    expect(result.rail).toBe('cregis');
    expect(result.eligible).toBe(true);
    expect(result.executable).toBe(false);
    expect(result.destination).toEqual({
      asset: 'USDT',
      network: 'tron',
      addressPresent: true,
    });
    expect(result.settlement).toEqual({
      currency: '195@TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      tokenAmount: '25',
      tokenAmountKnown: true,
    });
    expect(result.provider).toMatchObject({
      configured: true,
      environment: 'sandbox',
      credentialsPresent: true,
      executionEnabled: false,
      productionExecutionEnabled: false,
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'Organization Cregis executionEnabled is false',
        'CREGIS_PAYOUTS_ENABLED is not true',
      ])
    );
  });

  it('is executable only when sandbox config, destination, amount, and execution gates are on', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({
        connectionExecutionEnabled: true,
        effectiveExecutionEnabled: true,
      }),
      ...USDT_TRON,
      projectCoins: [USDT_TRON_COIN],
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(true);
    expect(result.executable).toBe(true);
    expect(result.provider.supportedCurrency).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('fails closed when credentials are missing', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({ hasApiKey: false }),
      ...USDT_TRON,
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.reasons).toContain('API credentials are missing');
  });

  it('fails closed when the gateway is missing', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({ hasGateway: false }),
      ...USDT_TRON,
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('Gateway URL is missing');
  });

  it('fails closed for an unsupported asset/network pair', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({
        connectionExecutionEnabled: true,
        effectiveExecutionEnabled: true,
      }),
      methodType: 'CRYPTO',
      destinationHandle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      destinationDetails: { address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS', asset: 'DOGE', network: 'tron' },
      payoutAmount: '25',
      payoutCurrency: 'USD',
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.settlement.currency).toBeNull();
    expect(result.reasons).toContain('Asset/network cannot be mapped to a Cregis currency identifier');
  });

  it('fails closed when the token amount cannot be determined', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({
        connectionExecutionEnabled: true,
        effectiveExecutionEnabled: true,
      }),
      methodType: 'CRYPTO',
      destinationHandle: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      destinationDetails: { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', asset: 'BTC', network: 'bitcoin' },
      payoutAmount: '25',
      payoutCurrency: 'USD',
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.settlement.tokenAmountKnown).toBe(false);
    expect(result.reasons).toContain(
      'Unsupported crypto denomination: USD amount cannot be sent as this asset without inventing FX'
    );
  });

  it('allows USD → USDT/USDC without inventing FX', () => {
    const usdc = evaluateCregisPayoutReadiness({
      connection: sandboxConnection(),
      methodType: 'CRYPTO',
      destinationHandle: '0x1111111111111111111111111111111111111111',
      destinationDetails: {
        address: '0x1111111111111111111111111111111111111111',
        asset: 'USDC',
        network: 'ethereum',
      },
      payoutAmount: '10.5',
      payoutCurrency: 'USD',
      platformEnabled: false,
      productionEnabled: false,
    });
    expect(usdc.eligible).toBe(true);
    expect(usdc.settlement.tokenAmount).toBe('10.5');
    expect(usdc.settlement.tokenAmountKnown).toBe(true);
  });

  it('rejects AUD → USDT/USDC under current policy', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection(),
      ...USDT_TRON,
      payoutCurrency: 'AUD',
      platformEnabled: false,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.settlement.tokenAmountKnown).toBe(false);
    expect(result.reasons).toContain(
      'AUD → USDT/USDC is not eligible under current policy without an explicit token amount'
    );
  });

  it('blocks production configuration when the production flag is disabled', () => {
    const connection = sandboxConnection({
      environment: 'production',
      connectionExecutionEnabled: true,
      effectiveExecutionEnabled: true,
    });
    expect(isCregisConnectionSelectable(connection, false)).toBe(false);
    const result = evaluateCregisPayoutReadiness({
      connection,
      ...USDT_TRON,
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.reasons).toContain(
      'Environment is production while CREGIS_PRODUCTION_PAYOUTS_ENABLED is not true'
    );
  });

  it('allows sandbox configuration even when execution is disabled', () => {
    const connection = sandboxConnection();
    expect(isCregisConnectionSelectable(connection, false)).toBe(true);
    const result = evaluateCregisPayoutReadiness({
      connection,
      ...USDT_TRON,
      platformEnabled: false,
      productionEnabled: false,
    });
    expect(result.provider.environment).toBe('sandbox');
    expect(result.eligible).toBe(true);
    expect(result.executable).toBe(false);
  });

  it('stops rather than assuming a production-looking gateway is sandbox', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({ gatewayLooksProduction: true }),
      ...USDT_TRON,
      platformEnabled: false,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('Gateway URL appears to be production rather than sandbox/test');
  });

  it('fails closed when the project coins list does not include the mapped currency', () => {
    const result = evaluateCregisPayoutReadiness({
      connection: sandboxConnection({
        connectionExecutionEnabled: true,
        effectiveExecutionEnabled: true,
      }),
      ...USDT_TRON,
      projectCoins: [{ coinName: 'TRON#Shasta', chainId: '195', tokenId: '195' }],
      platformEnabled: true,
      productionEnabled: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.provider.supportedCurrency).toBe(false);
    expect(result.reasons).toContain('Project payout_coins does not include this currency');
  });
});

describe('Cregis coins capability query', () => {
  it('calls only the documented coins endpoint', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      expect(String(url)).toContain(CREGIS_COINS_PATH);
      expect(String(url)).not.toContain(CREGIS_PAYOUT_CREATE_PATH);
      return jsonResponse({
        code: '00000',
        data: {
          payout_coins: [
            { coin_name: 'TRON#Shasta', chain_id: '195', token_id: '195' },
            {
              coin_name: 'USDT-TRC20',
              chain_id: '195',
              token_id: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            },
          ],
        },
      });
    });

    const result = await queryCregisProjectCoins(
      {
        apiKey: 'test-cregis-api-key',
        pid: 1,
        gatewayBaseUrl: 'https://gateway.example.test',
        executionEnabled: false,
        environment: 'sandbox',
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.endpoint).toBe(`https://gateway.example.test${CREGIS_COINS_PATH}`);
    expect(result.payoutCoins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ coinName: 'TRON#Shasta', chainId: '195', tokenId: '195' }),
      ])
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('Cregis selection without execution', () => {
  it('stamps WALLET + cregis + payout:{orgId}:{payoutId} for an eligible CRYPTO destination', () => {
    const fields = buildPayoutRailCreateFields({
      organizationId: 'org-1',
      currency: 'USD',
      methodType: 'CRYPTO',
      merchantHederaReady: false,
      merchantCregisReady: true,
      destinationHandle: USDT_TRON.destinationHandle,
      destinationDetails: USDT_TRON.destinationDetails,
      payoutAmount: '25',
      payoutId: 'payout-1',
    });
    expect(fields).toEqual({
      id: 'payout-1',
      rail_id: 'cregis',
      destination_kind: 'WALLET',
      idempotency_key: payoutIdempotencyKey('org-1', 'payout-1'),
    });
  });

  it('keeps the payout on manual when Cregis is not selectable', () => {
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'CRYPTO',
        merchantHederaReady: false,
        merchantCregisReady: false,
        destinationHandle: USDT_TRON.destinationHandle,
        destinationDetails: USDT_TRON.destinationDetails,
        payoutAmount: '25',
      })
    ).toBe('manual');
    expect(
      selectPayoutRail({
        currency: 'AUD',
        methodType: 'CRYPTO',
        merchantHederaReady: false,
        merchantCregisReady: true,
        destinationHandle: USDT_TRON.destinationHandle,
        destinationDetails: USDT_TRON.destinationDetails,
        payoutAmount: '25',
      })
    ).toBe('manual');
  });
});

describe('Cregis preflight does not create payouts', () => {
  it('never references the Cregis payout create path from check/selection/create surfaces', () => {
    const files = [
      'lib/payouts/rails/cregis-preflight.ts',
      'lib/payouts/rails/cregis-preflight.server.ts',
      'lib/payouts/rails/cregis-coins.ts',
      'lib/payouts/select-payout-rail.ts',
      'lib/payouts/stamp-payout-rail.ts',
      'lib/payouts/crypto-payout-destination.ts',
      'app/api/payout-methods/route.ts',
      'app/api/payout-batches/create/route.ts',
      'app/api/payout-batches/[id]/submit/route.ts',
      'app/api/payouts/rails/cregis/preflight/route.ts',
      'app/api/payouts/rails/cregis/connection/route.ts',
    ];
    for (const file of files) {
      const contents = source(file);
      expect(contents).not.toContain('/api/v2/payout');
      expect(contents).not.toContain('CREGIS_PAYOUT_CREATE_PATH');
    }
  });
});
