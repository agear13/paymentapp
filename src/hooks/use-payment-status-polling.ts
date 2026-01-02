/**
 * Payment Status Polling Hook
 * Polls payment link status with exponential backoff and timeout handling
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface PaymentStatusData {
  id: string;
  shortCode: string;
  currentStatus: 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  statusMessage: string;
  lastEventType: string | null;
  lastEventTimestamp: string | null;
  paymentMethod: 'STRIPE' | 'HEDERA' | null;
  validTransitions: string[];
  transactionInfo: {
    transactionId: string;
    paymentMethod: string;
    timestamp: string;
    amount: string;
    currency: string;
  } | null;
  expiresAt: string | null;
  isExpired: boolean;
  updatedAt: string;
}

interface UsePaymentStatusPollingOptions {
  /**
   * Payment link ID to poll
   */
  paymentLinkId: string;
  /**
   * Initial polling interval in milliseconds
   * @default 5000
   */
  initialInterval?: number;
  /**
   * Maximum polling interval for exponential backoff (in ms)
   * @default 30000 (30 seconds)
   */
  maxInterval?: number;
  /**
   * Timeout in milliseconds after which polling stops
   * @default 900000 (15 minutes)
   */
  timeout?: number;
  /**
   * Whether polling is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Callback when status changes
   */
  onStatusChange?: (status: PaymentStatusData) => void;
  /**
   * Callback when timeout occurs
   */
  onTimeout?: () => void;
  /**
   * Callback when polling encounters an error
   */
  onError?: (error: Error) => void;
}

interface UsePaymentStatusPollingResult {
  /**
   * Current status data
   */
  status: PaymentStatusData | null;
  /**
   * Loading state
   */
  isLoading: boolean;
  /**
   * Error state
   */
  error: Error | null;
  /**
   * Whether polling has timed out
   */
  hasTimedOut: boolean;
  /**
   * Whether polling is active
   */
  isPolling: boolean;
  /**
   * Manually trigger a status check
   */
  refetch: () => Promise<void>;
  /**
   * Stop polling
   */
  stopPolling: () => void;
  /**
   * Resume polling
   */
  resumePolling: () => void;
}

/**
 * Hook to poll payment link status with smart backoff and timeout
 * 
 * Features:
 * - 5-second default polling interval (single-flight, no overlap)
 * - Exponential backoff on errors (doubles up to max)
 * - Automatic termination on final states (PAID, EXPIRED, CANCELED)
 * - 15-minute timeout
 * - Status change callbacks
 * - Request cancellation on unmount/cleanup
 * 
 * @example
 * ```tsx
 * const { status, isLoading, hasTimedOut } = usePaymentStatusPolling({
 *   paymentLinkId: 'abc123',
 *   onStatusChange: (status) => console.log('Status changed:', status),
 *   onTimeout: () => router.push('/expired'),
 * });
 * ```
 */
export function usePaymentStatusPolling(
  options: UsePaymentStatusPollingOptions
): UsePaymentStatusPollingResult {
  const {
    paymentLinkId,
    initialInterval = 5000,
    maxInterval = 30000,
    timeout = 900000, // 15 minutes
    enabled = true,
    onStatusChange,
    onTimeout,
    onError,
  } = options;

  const [status, setStatus] = useState<PaymentStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isPolling, setIsPolling] = useState(enabled);
  const [currentInterval, setCurrentInterval] = useState(initialInterval);

  // Refs for polling control
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const consecutiveErrorsRef = useRef<number>(0);
  const previousStatusRef = useRef<string | null>(null);
  
  // Refs to avoid stale closures in setTimeout callbacks
  const isPollingRef = useRef(isPolling);
  const enabledRef = useRef(enabled);
  const intervalRef = useRef(currentInterval);
  const hadErrorRef = useRef(false);
  
  // Loop ID to prevent double-loop on remount/strict mode
  const loopIdRef = useRef(0);

  /**
   * Add random jitter to prevent synchronized polling (thundering herd)
   * @param ms - Base delay in milliseconds
   * @param pct - Jitter percentage (default 0.15 = 15%)
   * @returns Jittered delay as integer ms
   */
  const withJitter = useCallback((ms: number, pct: number = 0.15): number => {
    const variance = ms * pct;
    const jitter = (Math.random() * 2 - 1) * variance; // Random value between -variance and +variance
    return Math.round(ms + jitter);
  }, []);

  /**
   * Fetch current payment status with single-flight guarantee
   */
  const fetchStatus = useCallback(async (): Promise<boolean> => {
    // Single-flight guard
    if (inFlightRef.current) {
      return false;
    }

    inFlightRef.current = true;

    try {
      // Only set loading on first load (status is null) or after previous error
      // This prevents UI spinner flicker on every poll
      if (status === null || hadErrorRef.current) {
        setIsLoading(true);
      }
      setError(null);

      // Abort any previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // Create new AbortController for this request
      abortRef.current = new AbortController();

      const response = await fetch(`/api/payment-links/${paymentLinkId}/status`, {
        cache: 'no-store',
        signal: abortRef.current.signal,
      });
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Better handling of server errors (502/503/504)
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          errorMessage = `Server temporarily unavailable (${response.status}). Retrying with backoff...`;
        }
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const newStatus = result.data as PaymentStatusData;

      setStatus(newStatus);
      setIsLoading(false);

      // Reset error counter and flag on success
      consecutiveErrorsRef.current = 0;
      hadErrorRef.current = false;
      setCurrentInterval(initialInterval);

      // Check if status changed
      if (previousStatusRef.current !== newStatus.currentStatus) {
        previousStatusRef.current = newStatus.currentStatus;
        onStatusChange?.(newStatus);
      }

      // Check if we should stop polling (terminal states)
      const terminalStates: Array<PaymentStatusData['currentStatus']> = ['PAID', 'EXPIRED', 'CANCELED'];
      if (terminalStates.includes(newStatus.currentStatus)) {
        // Clear any scheduled timer immediately
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setIsPolling(false);
        isPollingRef.current = false;
        return true; // Signal terminal state reached
      }

      return false; // Not terminal, continue polling

    } catch (err) {
      // Ignore AbortError (expected on cleanup) - don't trigger backoff
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }

      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      hadErrorRef.current = true;
      onError?.(error);

      // Exponential backoff on error (not on abort)
      consecutiveErrorsRef.current += 1;
      const backoffMultiplier = Math.pow(2, Math.min(consecutiveErrorsRef.current - 1, 4));
      const newInterval = Math.min(initialInterval * backoffMultiplier, maxInterval);
      setCurrentInterval(newInterval);

      console.error('Payment status polling error:', error);

      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [paymentLinkId, initialInterval, maxInterval, status, onStatusChange, onError]);

  /**
   * Manual refetch
   */
  const refetch = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    
    // Clear scheduled timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  /**
   * Resume polling
   * NOTE: This resets the 15-minute timeout timer to the current time.
   * If you want "15 min total since first load", modify this to not reset startTimeRef.
   */
  const resumePolling = useCallback(() => {
    if (!hasTimedOut) {
      // Clear any existing timer to prevent double polling
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      setIsPolling(true);
      // Reset start time when resuming (resets the 15-min timeout)
      // Current behavior: timeout is "15 min since last resume", not "15 min total"
      startTimeRef.current = Date.now();
    }
  }, [hasTimedOut]);

  /**
   * Sync refs to avoid stale closures in setTimeout callbacks
   */
  useEffect(() => {
    isPollingRef.current = isPolling;
  }, [isPolling]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    intervalRef.current = currentInterval;
  }, [currentInterval]);

  /**
   * Recursive polling loop with single-flight guarantee
   * Hardened against stale closures, double-loop on remount, and thundering herd
   */
  useEffect(() => {
    if (!isPolling || !enabled) {
      // Clear timer if polling is disabled
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Increment loop ID to prevent double-loop on remount/strict mode
    loopIdRef.current += 1;
    const currentLoopId = loopIdRef.current;

    /**
     * Single polling loop iteration
     */
    const pollOnce = async () => {
      // Prevent stale loop from scheduling work (critical for strict mode / remount)
      if (currentLoopId !== loopIdRef.current) {
        return;
      }

      // Check timeout before polling
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= timeout) {
        setHasTimedOut(true);
        setIsPolling(false);
        isPollingRef.current = false;
        onTimeout?.();
        return;
      }

      // Fetch status (returns true if terminal state reached)
      const isTerminal = await fetchStatus();
      
      // Check again if this loop is still current (may have changed during async fetch)
      if (currentLoopId !== loopIdRef.current) {
        return;
      }
      
      // Stop if terminal state reached
      if (isTerminal) {
        return;
      }

      // Check timeout again after fetch completes
      const elapsedAfterFetch = Date.now() - startTimeRef.current;
      if (elapsedAfterFetch >= timeout) {
        setHasTimedOut(true);
        setIsPolling(false);
        isPollingRef.current = false;
        onTimeout?.();
        return;
      }

      // Schedule next poll only if still polling (use refs to avoid stale closure)
      if (isPollingRef.current && enabledRef.current) {
        // Check one more time if this loop is still current before scheduling
        if (currentLoopId !== loopIdRef.current) {
          return;
        }

        // Optional: Pause polling when tab is hidden
        let nextDelay = intervalRef.current;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          nextDelay = Math.max(nextDelay, 5000); // At least 5s when hidden
        }

        // Apply jitter to prevent thundering herd (thousands of clients hitting at same time)
        const jitteredDelay = withJitter(nextDelay, 0.15);

        timerRef.current = setTimeout(pollOnce, jitteredDelay);
      }
    };

    // Start the polling loop
    pollOnce();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [isPolling, enabled, timeout, fetchStatus, onTimeout, withJitter]);

  return {
    status,
    isLoading,
    error,
    hasTimedOut,
    isPolling,
    refetch,
    stopPolling,
    resumePolling,
  };
}






