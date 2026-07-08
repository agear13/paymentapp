/**
 * Wallet Error Detection Utilities
 * 
 * Helpers to identify common wallet connection errors
 * and provide appropriate user feedback.
 */

/** Shown on the public invoice page when the HashConnect bundle fails to load. */
export const CRYPTO_MODULE_LOAD_ERROR_MESSAGE =
  "The cryptocurrency payment module couldn't be loaded. Please refresh the page or try again in a few moments.";

/**
 * Detects chunk mismatch / manifest errors during dynamic imports
 * These occur when deployment happens while user has stale code
 */
export function isChunkMismatchError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  
  return (
    msg.includes('chunk mismatch') ||
    msg.includes('loading chunk') ||
    msg.includes('manifest') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module')
  );
}

/**
 * Detects HashPack URI missing errors
 * These occur when HashPack extension is still initializing
 */
export function isUriMissingError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  
  return (
    msg.includes('uri missing') ||
    msg.includes('pairing string created: undefined') ||
    msg.includes('pairingstring') && msg.includes('undefined')
  );
}

/**
 * Maps wallet module load failures to customer-safe copy (never expose chunk IDs).
 */
export function formatWalletModuleLoadError(err: unknown): string {
  if (isChunkMismatchError(err)) {
    return CRYPTO_MODULE_LOAD_ERROR_MESSAGE;
  }

  const msg = err instanceof Error ? err.message : String(err);
  if (/identifier '.+' has already been declared/i.test(msg)) {
    return CRYPTO_MODULE_LOAD_ERROR_MESSAGE;
  }

  return msg || CRYPTO_MODULE_LOAD_ERROR_MESSAGE;
}

