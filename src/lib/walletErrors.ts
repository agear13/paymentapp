/**
 * Wallet Error Detection Utilities
 * 
 * Helpers to identify common wallet connection errors
 * and provide appropriate user feedback.
 */

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

