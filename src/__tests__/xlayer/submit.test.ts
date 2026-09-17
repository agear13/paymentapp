import { parseSubmitInput } from '@/lib/xlayer/validation';

describe('xlayer submit validation', () => {
  const valid = {
    transactionHash: `0x${'ab'.repeat(32)}`,
    walletAddress: '0x0000000000000000000000000000000000000001',
    chainId: 1952,
  };

  it('accepts a strict X Layer hash and wallet', () => {
    const parsed = parseSubmitInput(valid);
    expect(parsed.chainId).toBe(1952);
    expect(parsed.transactionHash).toBe(valid.transactionHash);
  });

  it('rejects an invalid hash', () => {
    expect(() => parseSubmitInput({ ...valid, transactionHash: '0x1234' })).toThrow(/hash/i);
  });

  it('rejects the wrong chain', () => {
    expect(() => parseSubmitInput({ ...valid, chainId: 1 })).toThrow(/chain/i);
  });
});
