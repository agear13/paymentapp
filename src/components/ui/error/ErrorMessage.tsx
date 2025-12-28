/**
 * Error Message Components
 * 
 * User-friendly error displays with recovery suggestions
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Error Severity
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Error Message
 * 
 * Inline error message with icon and optional actions
 * 
 * @example
 * ```tsx
 * <ErrorMessage
 *   title="Payment failed"
 *   message="Insufficient funds in wallet"
 *   severity="error"
 * />
 * ```
 */
export interface ErrorMessageProps {
  /** Error title */
  title?: string;
  /** Error message */
  message: string;
  /** Severity level */
  severity?: ErrorSeverity;
  /** Show icon */
  showIcon?: boolean;
  /** Action buttons */
  actions?: React.ReactNode;
  /** Dismissible */
  onDismiss?: () => void;
  className?: string;
}

const severityStyles = {
  error: {
    container: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
    message: 'text-red-700 dark:text-red-400',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-400',
    title: 'text-yellow-800 dark:text-yellow-300',
    message: 'text-yellow-700 dark:text-yellow-400',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-300',
    message: 'text-blue-700 dark:text-blue-400',
  },
};

export function ErrorMessage({
  title,
  message,
  severity = 'error',
  showIcon = true,
  actions,
  onDismiss,
  className,
}: ErrorMessageProps) {
  const styles = severityStyles[severity];

  return (
    <div
      className={cn(
        'border rounded-lg p-4',
        styles.container,
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <div className={cn('flex-shrink-0', styles.icon)}>
            {severity === 'error' && (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {severity === 'warning' && (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {severity === 'info' && (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={cn('text-sm font-medium mb-1', styles.title)}>
              {title}
            </h3>
          )}
          <p className={cn('text-sm', styles.message)}>{message}</p>

          {actions && <div className="mt-3">{actions}</div>}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className={cn(
              'flex-shrink-0 ml-2 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
              styles.icon
            )}
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Validation Error
 * 
 * Form field validation error
 * 
 * @example
 * ```tsx
 * <ValidationError message="Email is required" />
 * ```
 */
export interface ValidationErrorProps {
  message: string;
  className?: string;
}

export function ValidationError({ message, className }: ValidationErrorProps) {
  return (
    <p
      className={cn(
        'text-sm text-red-600 dark:text-red-400 mt-1',
        className
      )}
      role="alert"
    >
      {message}
    </p>
  );
}

/**
 * Error List
 * 
 * Display multiple errors
 * 
 * @example
 * ```tsx
 * <ErrorList
 *   errors={[
 *     'Amount must be greater than 0',
 *     'Currency is required',
 *   ]}
 * />
 * ```
 */
export interface ErrorListProps {
  errors: string[];
  title?: string;
  className?: string;
}

export function ErrorList({ errors, title, className }: ErrorListProps) {
  if (errors.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4',
        className
      )}
      role="alert"
    >
      {title && (
        <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
          {title}
        </h3>
      )}
      <ul className="list-disc list-inside space-y-1">
        {errors.map((error, index) => (
          <li
            key={index}
            className="text-sm text-red-700 dark:text-red-400"
          >
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Format error for user display
 * 
 * Converts technical errors to user-friendly messages
 */
export function formatErrorMessage(error: Error | string): {
  title: string;
  message: string;
  suggestion?: string;
} {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Network errors
  if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server.',
      suggestion: 'Please check your internet connection and try again.',
    };
  }

  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
    return {
      title: 'Authentication Required',
      message: 'Your session has expired.',
      suggestion: 'Please log in again to continue.',
    };
  }

  // Permission errors
  if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
    return {
      title: 'Access Denied',
      message: 'You don\'t have permission to perform this action.',
      suggestion: 'Contact your administrator if you need access.',
    };
  }

  // Not found errors
  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    return {
      title: 'Not Found',
      message: 'The requested resource could not be found.',
      suggestion: 'Please check the URL and try again.',
    };
  }

  // Rate limit errors
  if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
    return {
      title: 'Too Many Requests',
      message: 'You\'ve made too many requests.',
      suggestion: 'Please wait a moment and try again.',
    };
  }

  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('server error')) {
    return {
      title: 'Server Error',
      message: 'Something went wrong on our end.',
      suggestion: 'Please try again later or contact support if the problem persists.',
    };
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return {
      title: 'Validation Error',
      message: errorMessage,
      suggestion: 'Please check your input and try again.',
    };
  }

  // Generic error
  return {
    title: 'Error',
    message: errorMessage || 'An unexpected error occurred.',
    suggestion: 'Please try again or contact support if the problem persists.',
  };
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Basic Error:
 * ```tsx
 * <ErrorMessage
 *   title="Payment Failed"
 *   message="Insufficient funds in wallet"
 *   severity="error"
 * />
 * ```
 * 
 * With Actions:
 * ```tsx
 * <ErrorMessage
 *   title="Connection Lost"
 *   message="Unable to reach the server"
 *   severity="error"
 *   actions={
 *     <button onClick={retry}>Retry</button>
 *   }
 * />
 * ```
 * 
 * Dismissible:
 * ```tsx
 * <ErrorMessage
 *   message="This is a warning"
 *   severity="warning"
 *   onDismiss={() => setShowWarning(false)}
 * />
 * ```
 * 
 * Validation:
 * ```tsx
 * <input type="email" />
 * {errors.email && (
 *   <ValidationError message={errors.email} />
 * )}
 * ```
 * 
 * Multiple Errors:
 * ```tsx
 * <ErrorList
 *   title="Please fix the following errors:"
 *   errors={[
 *     'Amount must be greater than 0',
 *     'Currency is required',
 *     'Wallet address is invalid',
 *   ]}
 * />
 * ```
 * 
 * Formatted Error:
 * ```tsx
 * try {
 *   await createPaymentLink(data);
 * } catch (error) {
 *   const formatted = formatErrorMessage(error);
 *   <ErrorMessage
 *     title={formatted.title}
 *     message={formatted.message}
 *     actions={
 *       formatted.suggestion && (
 *         <p className="text-sm mt-2">{formatted.suggestion}</p>
 *       )
 *     }
 *   />
 * }
 * ```
 */







