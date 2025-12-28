/**
 * Integration Failure Handling Test Suite
 * 
 * Tests for Sprint 24 integration failure handling:
 * - Error categorization (Stripe, Hedera, Xero, CoinGecko)
 * - Circuit breaker pattern
 * - Retry strategies
 * - Network health checks
 */

import {
  categorizeStripeError,
  categorizeHederaError,
  categorizeXeroError,
  categorizeCoinGeckoError,
  handleIntegrationFailure,
  getCircuitBreakerState,
  recordSuccess,
  recordFailure,
  isCircuitBreakerOpen,
  checkHederaNetworkHealth,
} from '@/lib/integration/failure-handler';

// Mock fetch for network tests
global.fetch = jest.fn();

describe('Integration Failure Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // Error Categorization - Stripe
  // ========================================================================

  describe('categorizeStripeError', () => {
    it('should categorize connection error as NETWORK', () => {
      const error = { type: 'StripeConnectionError', message: 'Connection failed' };
      expect(categorizeStripeError(error)).toBe('NETWORK');
    });

    it('should categorize rate limit error', () => {
      const error = { type: 'StripeRateLimitError', message: 'Too many requests' };
      expect(categorizeStripeError(error)).toBe('RATE_LIMIT');
    });

    it('should categorize auth error', () => {
      const error = { type: 'StripeAuthenticationError', message: 'Invalid API key' };
      expect(categorizeStripeError(error)).toBe('AUTH');
    });

    it('should categorize invalid request as VALIDATION', () => {
      const error = { type: 'StripeInvalidRequestError', message: 'Invalid parameter' };
      expect(categorizeStripeError(error)).toBe('VALIDATION');
    });

    it('should categorize 5xx errors as SERVER_ERROR', () => {
      const error = { statusCode: 500, message: 'Internal error' };
      expect(categorizeStripeError(error)).toBe('SERVER_ERROR');
    });

    it('should categorize unknown errors', () => {
      const error = { type: 'UnknownError', message: 'Something went wrong' };
      expect(categorizeStripeError(error)).toBe('UNKNOWN');
    });
  });

  // ========================================================================
  // Error Categorization - Hedera
  // ========================================================================

  describe('categorizeHederaError', () => {
    it('should detect timeout errors', () => {
      const error = { message: 'Request timed out' };
      expect(categorizeHederaError(error)).toBe('TIMEOUT');
    });

    it('should detect network errors', () => {
      const error = { message: 'Network connection failed' };
      expect(categorizeHederaError(error)).toBe('NETWORK');
    });

    it('should detect rate limit errors', () => {
      const error = { message: 'Too many requests, rate limit exceeded' };
      expect(categorizeHederaError(error)).toBe('RATE_LIMIT');
    });

    it('should detect not found errors', () => {
      const error = { message: 'Account does not exist' };
      expect(categorizeHederaError(error)).toBe('NOT_FOUND');
    });

    it('should detect validation errors', () => {
      const error = { message: 'Invalid transaction format' };
      expect(categorizeHederaError(error)).toBe('VALIDATION');
    });

    it('should handle unknown Hedera errors', () => {
      const error = { message: 'Mysterious error' };
      expect(categorizeHederaError(error)).toBe('UNKNOWN');
    });
  });

  // ========================================================================
  // Error Categorization - Xero
  // ========================================================================

  describe('categorizeXeroError', () => {
    it('should categorize 401 as AUTH', () => {
      const error = { statusCode: 401 };
      expect(categorizeXeroError(error)).toBe('AUTH');
    });

    it('should categorize 403 as AUTH', () => {
      const error = { response: { status: 403 } };
      expect(categorizeXeroError(error)).toBe('AUTH');
    });

    it('should categorize 429 as RATE_LIMIT', () => {
      const error = { statusCode: 429 };
      expect(categorizeXeroError(error)).toBe('RATE_LIMIT');
    });

    it('should categorize 400 as VALIDATION', () => {
      const error = { statusCode: 400 };
      expect(categorizeXeroError(error)).toBe('VALIDATION');
    });

    it('should categorize 404 as NOT_FOUND', () => {
      const error = { statusCode: 404 };
      expect(categorizeXeroError(error)).toBe('NOT_FOUND');
    });

    it('should categorize 5xx as SERVER_ERROR', () => {
      const error = { statusCode: 503 };
      expect(categorizeXeroError(error)).toBe('SERVER_ERROR');
    });

    it('should detect timeout from message', () => {
      const error = { message: 'Request timeout' };
      expect(categorizeXeroError(error)).toBe('TIMEOUT');
    });

    it('should detect network errors', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      expect(categorizeXeroError(error)).toBe('NETWORK');
    });
  });

  // ========================================================================
  // Error Categorization - CoinGecko
  // ========================================================================

  describe('categorizeCoinGeckoError', () => {
    it('should categorize 429 as RATE_LIMIT', () => {
      const error = { response: { status: 429 } };
      expect(categorizeCoinGeckoError(error)).toBe('RATE_LIMIT');
    });

    it('should categorize 5xx as SERVER_ERROR', () => {
      const error = { statusCode: 500 };
      expect(categorizeCoinGeckoError(error)).toBe('SERVER_ERROR');
    });

    it('should detect timeout', () => {
      const error = { message: 'Request timeout' };
      expect(categorizeCoinGeckoError(error)).toBe('TIMEOUT');
    });

    it('should detect network errors', () => {
      const error = { code: 'ECONNREFUSED' };
      expect(categorizeCoinGeckoError(error)).toBe('NETWORK');
    });
  });

  // ========================================================================
  // Integration Failure Handling
  // ========================================================================

  describe('handleIntegrationFailure', () => {
    it('should not retry permanent errors (VALIDATION)', () => {
      const error = { type: 'StripeInvalidRequestError', message: 'Invalid' };
      const result = handleIntegrationFailure('STRIPE', error, 1);

      expect(result.permanent).toBe(true);
      expect(result.shouldRetry).toBe(false);
      expect(result.category).toBe('VALIDATION');
    });

    it('should retry transient errors (NETWORK) with exponential backoff', () => {
      const error = { type: 'StripeConnectionError' };
      
      const result1 = handleIntegrationFailure('STRIPE', error, 1);
      expect(result1.shouldRetry).toBe(true);
      expect(result1.retryAfterMs).toBe(2000); // 1 * 2^1
      
      const result2 = handleIntegrationFailure('STRIPE', error, 2);
      expect(result2.shouldRetry).toBe(true);
      expect(result2.retryAfterMs).toBe(4000); // 1 * 2^2
      
      const result3 = handleIntegrationFailure('STRIPE', error, 3);
      expect(result3.shouldRetry).toBe(true);
      expect(result3.retryAfterMs).toBe(8000); // 1 * 2^3
    });

    it('should use longer backoff for rate limits', () => {
      const error = { type: 'StripeRateLimitError' };
      
      const result1 = handleIntegrationFailure('STRIPE', error, 1);
      expect(result1.shouldRetry).toBe(true);
      expect(result1.retryAfterMs).toBe(60000); // 60s * 2^0
      
      const result2 = handleIntegrationFailure('STRIPE', error, 2);
      expect(result2.retryAfterMs).toBe(120000); // 60s * 2^1
    });

    it('should limit maximum retries for transient errors', () => {
      const error = { type: 'StripeConnectionError' };
      
      const result = handleIntegrationFailure('STRIPE', error, 10);
      expect(result.shouldRetry).toBe(false);
    });

    it('should allow more retries for rate limits', () => {
      const error = { type: 'StripeRateLimitError' };
      
      const result = handleIntegrationFailure('STRIPE', error, 9);
      expect(result.shouldRetry).toBe(true);
    });
  });

  // ========================================================================
  // Circuit Breaker
  // ========================================================================

  describe('Circuit Breaker', () => {
    it('should start in CLOSED state', () => {
      const state = getCircuitBreakerState('STRIPE');
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should increment failure count on failures', () => {
      recordFailure('STRIPE', 'NETWORK');
      const state = getCircuitBreakerState('STRIPE');
      expect(state.failureCount).toBe(1);
    });

    it('should open circuit after threshold failures', () => {
      // Record 5 failures (threshold)
      for (let i = 0; i < 5; i++) {
        recordFailure('STRIPE', 'NETWORK');
      }
      
      const state = getCircuitBreakerState('STRIPE');
      expect(state.state).toBe('OPEN');
      expect(isCircuitBreakerOpen('STRIPE')).toBe(true);
    });

    it('should not count permanent failures towards circuit breaker', () => {
      recordFailure('STRIPE', 'VALIDATION');
      recordFailure('STRIPE', 'VALIDATION');
      recordFailure('STRIPE', 'VALIDATION');
      
      const state = getCircuitBreakerState('STRIPE');
      expect(state.failureCount).toBe(0);
      expect(state.state).toBe('CLOSED');
    });

    it('should close circuit on successful call', () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        recordFailure('STRIPE', 'NETWORK');
      }
      expect(isCircuitBreakerOpen('STRIPE')).toBe(true);
      
      // Simulate recovery after timeout (would transition to HALF_OPEN)
      // Then record success
      recordSuccess('STRIPE');
      
      const state = getCircuitBreakerState('STRIPE');
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should track circuit breakers independently by identifier', () => {
      // Create failures for org1
      for (let i = 0; i < 5; i++) {
        recordFailure('XERO', 'NETWORK', 'org1');
      }
      
      // org1 should be open
      expect(isCircuitBreakerOpen('XERO', 'org1')).toBe(true);
      
      // org2 should still be closed
      expect(isCircuitBreakerOpen('XERO', 'org2')).toBe(false);
    });
  });

  // ========================================================================
  // Hedera Network Health Check
  // ========================================================================

  describe('checkHederaNetworkHealth', () => {
    it('should return healthy status for successful check', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await checkHederaNetworkHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('mirrornode.hedera.com'),
        expect.any(Object)
      );
    });

    it('should return unhealthy for non-200 response', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await checkHederaNetworkHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('503');
    });

    it('should handle network timeout', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockRejectedValue(new Error('Timeout'));

      const result = await checkHederaNetworkHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('should measure latency', async () => {
      const mockFetch = global.fetch as jest.Mock;
      
      // Simulate 100ms delay
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true, status: 200 }), 100)
        )
      );

      const result = await checkHederaNetworkHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(100);
    });
  });
});







