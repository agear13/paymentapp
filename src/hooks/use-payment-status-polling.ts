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
      setIsLoading(true);
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

      // Reset error counter on success
      consecutiveErrorsRef.current = 0;
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
        return true; // Signal terminal state reached
      }

      return false; // Not terminal, continue polling

    } catch (err) {
      // Ignore AbortError (expected on cleanup)
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }

      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      onError?.(error);

      // Exponential backoff on error
      consecutiveErrorsRef.current += 1;
      const backoffMultiplier = Math.pow(2, Math.min(consecutiveErrorsRef.current - 1, 4));
      const newInterval = Math.min(initialInterval * backoffMultiplier, maxInterval);
      setCurrentInterval(newInterval);

      console.error('Payment status polling error:', error);

      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [paymentLinkId, initialInterval, maxInterval, onStatusChange, onError]);

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
   */
  const resumePolling = useCallback(() => {
    if (!hasTimedOut) {
      // Clear any existing timer to prevent double polling
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      setIsPolling(true);
      // Reset start time only when resuming
      startTimeRef.current = Date.now();
    }
  }, [hasTimedOut]);

  /**
   * Recursive polling loop with single-flight guarantee
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

    /**
     * Single polling loop iteration
     */
    const pollOnce = async () => {
      // Check timeout before polling
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= timeout) {
        setHasTimedOut(true);
        setIsPolling(false);
        onTimeout?.();
        return;
      }

      // Fetch status (returns true if terminal state reached)
      const isTerminal = await fetchStatus();
      
      // Stop if terminal state reached
      if (isTerminal) {
        return;
      }

      // Check timeout again after fetch completes
      const elapsedAfterFetch = Date.now() - startTimeRef.current;
      if (elapsedAfterFetch >= timeout) {
        setHasTimedOut(true);
        setIsPolling(false);
        onTimeout?.();
        return;
      }

      // Schedule next poll only if still polling
      if (isPolling && enabled) {
        // Optional: Pause polling when tab is hidden
        let nextDelay = currentInterval;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          nextDelay = Math.max(nextDelay, 5000); // At least 5s when hidden
        }

        timerRef.current = setTimeout(pollOnce, nextDelay);
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
  }, [isPolling, enabled, currentInterval, timeout, fetchStatus, onTimeout]);

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






