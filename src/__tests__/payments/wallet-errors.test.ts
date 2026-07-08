import {
  CRYPTO_MODULE_LOAD_ERROR_MESSAGE,
  formatWalletModuleLoadError,
  isChunkMismatchError,
} from '@/lib/walletErrors';

describe('walletErrors', () => {
  it('detects webpack chunk load failures', () => {
    expect(isChunkMismatchError(new Error('Loading chunk 1257 failed'))).toBe(true);
  });

  it('maps chunk errors to customer-safe copy', () => {
    expect(
      formatWalletModuleLoadError(new Error('Loading chunk 1257 failed'))
    ).toBe(CRYPTO_MODULE_LOAD_ERROR_MESSAGE);
  });

  it('maps duplicate identifier parse failures to customer-safe copy', () => {
    expect(
      formatWalletModuleLoadError(new Error("Identifier 'n' has already been declared"))
    ).toBe(CRYPTO_MODULE_LOAD_ERROR_MESSAGE);
  });
});
