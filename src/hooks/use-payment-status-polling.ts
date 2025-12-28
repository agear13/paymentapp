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
   * @default 3000
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
 * - 3-second default polling interval
 * - Exponential backoff on errors (doubles up to max)
 * - Automatic termination on final states (PAID, EXPIRED, CANCELED)
 * - 15-minute timeout
 * - Status change callbacks
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
    initialInterval = 3000,
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

  const intervalRef = useRef<NodeJS.Timeout>();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(Date.now());
  const consecutiveErrorsRef = useRef<number>(0);
  const previousStatusRef = useRef<string | null>(null);

  /**
   * Fetch current payment status
   */
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/payment-links/${paymentLinkId}/status`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
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

      // Check if we should stop polling (final states)
      const finalStates: Array<PaymentStatusData['currentStatus']> = ['PAID', 'EXPIRED', 'CANCELED'];
      if (finalStates.includes(newStatus.currentStatus)) {
        setIsPolling(false);
      }

    } catch (err) {
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  /**
   * Resume polling
   */
  const resumePolling = useCallback(() => {
    if (!hasTimedOut) {
      setIsPolling(true);
      startTimeRef.current = Date.now();
    }
  }, [hasTimedOut]);

  /**
   * Set up polling interval
   */
  useEffect(() => {
    if (!isPolling || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    // Initial fetch
    fetchStatus();

    // Set up interval
    intervalRef.current = setInterval(() => {
      // Check timeout
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= timeout) {
        setHasTimedOut(true);
        setIsPolling(false);
        onTimeout?.();
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
        return;
      }

      fetchStatus();
    }, currentInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPolling, enabled, currentInterval, timeout, fetchStatus, onTimeout]);

  /**
   * Set up timeout
   */
  useEffect(() => {
    if (!enabled || !isPolling) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setHasTimedOut(true);
      setIsPolling(false);
      onTimeout?.();
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, isPolling, timeout, onTimeout]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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






