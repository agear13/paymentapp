/**
 * Hedera Transaction ID Normalization
 * 
 * Hedera transaction IDs come in two formats:
 * - HashPack/SDK format: "0.0.5363033@1769582713.055549545"
 * - Mirror Node format: "0.0.5363033-1769582713-055549545"
 * 
 * We normalize to the dash format for consistent storage and correlation ID generation.
 */

/**
 * Normalize a Hedera transaction ID to the canonical dash format.
 * 
 * @param txId - Transaction ID in either @ or - format
 * @returns Normalized transaction ID in format: "0.0.x-seconds-nanos"
 * 
 * @example
 * normalizeHederaTransactionId("0.0.5363033@1769582713.055549545")
 * // Returns: "0.0.5363033-1769582713-055549545"
 * 
 * normalizeHederaTransactionId("0.0.5363033-1769582713-055549545")
 * // Returns: "0.0.5363033-1769582713-055549545" (unchanged)
 */
export function normalizeHederaTransactionId(txId: string): string {
  try {
    // If already in dash format (contains two dashes after account ID), return as-is
    const dashPattern = /^0\.0\.\d+-\d+-\d+$/;
    if (dashPattern.test(txId)) {
      return txId;
    }

    // Parse @ format: "0.0.x@seconds.nanos"
    const atPattern = /^(0\.0\.\d+)@(\d+)\.(\d+)$/;
    const match = txId.match(atPattern);
    
    if (!match) {
      // Neither format matched - return original
      console.warn('[txid] Unable to parse transaction ID format:', txId);
      return txId;
    }

    const [, accountId, seconds, nanos] = match;
    
    // Ensure nanos is exactly 9 digits (pad with leading zeros if needed)
    const normalizedNanos = nanos.padStart(9, '0');
    
    return `${accountId}-${seconds}-${normalizedNanos}`;
  } catch (error) {
    // On any error, return original to avoid breaking existing functionality
    console.error('[txid] Error normalizing transaction ID:', error);
    return txId;
  }
}

/**
 * Check if a transaction ID is already in normalized (dash) format.
 * 
 * @param txId - Transaction ID to check
 * @returns true if already in dash format
 */
export function isNormalizedFormat(txId: string): boolean {
  return /^0\.0\.\d+-\d+-\d+$/.test(txId);
}

