/**
 * Error Boundary Component
 * 
 * React error boundary to catch and display errors gracefully
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { formatErrorMessage } from './ErrorMessage';

export interface ErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Fallback UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Error callback */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Show error details (development only) */
  showDetails?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary
 * 
 * Catches errors in child components and displays fallback UI
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <PaymentLinksList />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error
    console.error('Error caught by boundary:', error, errorInfo);

    // Call error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error reporting service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default fallback
      const formatted = formatErrorMessage(this.state.error);

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {formatted.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {formatted.message}
              </p>
              {formatted.suggestion && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                  {formatted.suggestion}
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Error details (development only) */}
            {this.props.showDetails && process.env.NODE_ENV === 'development' && (
              <details className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                  Error Details
                </summary>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Error:
                    </p>
                    <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Component Stack:
                      </p>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Basic Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <PaymentLinksList />
 * </ErrorBoundary>
 * ```
 * 
 * With Custom Fallback:
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <h2>Oops! Something went wrong</h2>
 *       <p>{error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 * >
 *   <PaymentLinksList />
 * </ErrorBoundary>
 * ```
 * 
 * With Error Logging:
 * ```tsx
 * <ErrorBoundary
 *   onError={(error, errorInfo) => {
 *     logErrorToSentry(error, errorInfo);
 *   }}
 *   showDetails={process.env.NODE_ENV === 'development'}
 * >
 *   <PaymentLinksList />
 * </ErrorBoundary>
 * ```
 * 
 * Multiple Boundaries:
 * ```tsx
 * function Dashboard() {
 *   return (
 *     <div>
 *       <ErrorBoundary>
 *         <Stats />
 *       </ErrorBoundary>
 *       
 *       <ErrorBoundary>
 *         <PaymentLinksList />
 *       </ErrorBoundary>
 *       
 *       <ErrorBoundary>
 *         <RecentTransactions />
 *       </ErrorBoundary>
 *     </div>
 *   );
 * }
 * ```
 */







