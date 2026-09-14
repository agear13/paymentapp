import { interpretConnectedWiseEconomics } from '@/lib/connected-intelligence/explanation';

describe('interpretConnectedWiseEconomics', () => {
  it('does not fabricate savings or winner claims', () => {
    const result = interpretConnectedWiseEconomics({
      wiseRate: 12422.11,
      referenceRate: 12655,
      feeAmount: 12.4,
      feeCurrency: 'AUD',
      totalCost: {
        state: 'known',
        sourceAmount: 10000,
        sourceCurrency: 'AUD',
        explicitFeeAmount: 12.4,
        explicitFeeCurrency: 'AUD',
        destinationAmount: 123987680,
        destinationCurrency: 'IDR',
        effectiveRate: 12398.768,
        method: 'source_fee_then_convert',
      },
      comparableProvidersUnknown: true,
    });

    const text = [...result.statements, ...result.unknowns].join(' ');
    expect(text).not.toMatch(/cheapest|98%|switch to Wise|better than OFX|save/i);
    expect(result.statements.some((item) => item.includes('below the RBA official'))).toBe(true);
    expect(result.statements.some((item) => item.includes('comparable customer-specific'))).toBe(
      true
    );
  });
});
