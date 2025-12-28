/**
 * Global Error Page
 * 
 * Next.js error page for unhandled errors
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { formatErrorMessage } from '@/components/ui/error/ErrorMessage';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log error to error reporting service
    console.error('Global error:', error);
  }, [error]);

  const formatted = formatErrorMessage(error);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          {/* Error Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full mb-6">
            <svg
              className="w-10 h-10 text-red-600 dark:text-red-400"
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

          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {formatted.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            {formatted.message}
          </p>
          {formatted.suggestion && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
              {formatted.suggestion}
            </p>
          )}

          {/* Error ID (for support) */}
          {error.digest && (
            <p className="text-xs text-gray-400 dark:text-gray-600 font-mono mb-8">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-center"
          >
            Go Home
          </Link>
        </div>

        {/* Support Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Need help?{' '}
            <a
              href="mailto:support@example.com"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Contact Support
            </a>
          </p>
        </div>

        {/* Development Details */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              Error Details (Development Only)
            </summary>
            <div className="mt-3">
              <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto">
                {error.stack}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}







