import 'server-only';

import { getFxService } from '@/lib/fx';
import type { Currency } from '@/lib/fx/types';
import type { TokenType } from '@/lib/hedera/constants';

export type SimpleTokenCheckoutAmount = {
  tokenType: string;
  requiredAmount: string;
  requiredAmountRaw: number;
  fiatAmount: string;
  fiatCurrency: string;
  rate: string;
  exchangeRate: number;
  isRecommended: boolean;
};

/**
 * Shared fiat → token amount calculation used by interactive checkout rails
 * (HashPack, MetaMask, etc.). Hedera adds fees/recommendation on top.
 */
export async function calculateSimpleTokenCheckoutAmounts(input: {
  fiatAmount: number;
  fiatCurrency: string;
  tokens: readonly string[];
  defaultRecommendedToken?: string;
  formatAmount?: (amount: number, tokenType: string) => string;
}): Promise<SimpleTokenCheckoutAmount[]> {
  const fxService = getFxService();
  const format =
    input.formatAmount ??
    ((amount: number) => amount.toFixed(6));

  const calculations = await Promise.all(
    input.tokens.map(async (tokenType) => {
      const calc = await fxService.calculateCryptoAmount(
        input.fiatAmount,
        input.fiatCurrency as Currency,
        tokenType as TokenType
      );
      return { tokenType, calc };
    })
  );

  const recommended = input.defaultRecommendedToken ?? 'USDC';

  return calculations.map(({ tokenType, calc }) => ({
    tokenType,
    requiredAmount: format(calc.targetAmount, tokenType),
    requiredAmountRaw: calc.targetAmount,
    fiatAmount: input.fiatAmount.toFixed(2),
    fiatCurrency: input.fiatCurrency,
    rate: `${calc.rate.toFixed(8)} ${input.fiatCurrency}/${tokenType}`,
    exchangeRate: calc.rate,
    isRecommended: tokenType === recommended,
  }));
}
