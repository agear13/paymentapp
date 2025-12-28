/**
 * Generic polling hook
 * Executes a callback function at a specified interval
 */

import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  /**
   * Polling interval in milliseconds
   * @default 3000
   */
  interval?: number;
  /**
   * Whether polling is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether to run immediately on mount
   * @default true
   */
  runOnMount?: boolean;
}

/**
 * Hook to run a callback function at a specified interval
 * 
 * @param callback - Function to execute on each poll
 * @param options - Polling configuration options
 * 
 * @example
 * ```tsx
 * usePolling(async () => {
 *   await fetchData();
 * }, { interval: 5000, enabled: isActive });
 * ```
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions = {}
) {
  const {
    interval = 3000,
    enabled = true,
    runOnMount = true,
  } = options;

  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Update the saved callback if it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (!enabled) {
      // Clear interval if polling is disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    // Run immediately on mount if requested
    if (runOnMount) {
      savedCallback.current();
    }

    // Set up interval
    intervalRef.current = setInterval(() => {
      savedCallback.current();
    }, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, enabled, runOnMount]);

  // Manual trigger function
  const trigger = useCallback(() => {
    savedCallback.current();
  }, []);

  return { trigger };
}













