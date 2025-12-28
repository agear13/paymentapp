/**
 * Loading Spinner Components
 * 
 * Various spinner styles for different loading scenarios
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Spinner Size
 */
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Spinner Variant
 */
export type SpinnerVariant = 'default' | 'primary' | 'secondary' | 'white';

export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color variant */
  variant?: SpinnerVariant;
  /** Additional className */
  className?: string;
  /** Accessible label */
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-4',
};

const variantClasses: Record<SpinnerVariant, string> = {
  default: 'border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300',
  primary: 'border-blue-200 border-t-blue-600',
  secondary: 'border-gray-200 border-t-gray-500',
  white: 'border-white/30 border-t-white',
};

/**
 * Circular Spinner
 * 
 * @example
 * ```tsx
 * <Spinner size="md" variant="primary" />
 * ```
 */
export function Spinner({
  size = 'md',
  variant = 'default',
  className,
  label = 'Loading',
}: SpinnerProps) {
  return (
    <div
      className={cn(
        'inline-block rounded-full animate-spin',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Dots Spinner
 * 
 * Three animated dots
 * 
 * @example
 * ```tsx
 * <DotsSpinner />
 * ```
 */
export interface DotsSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
}

export function DotsSpinner({
  size = 'md',
  variant = 'default',
  className,
}: DotsSpinnerProps) {
  const dotSize = {
    xs: 'h-1 w-1',
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  }[size];

  const dotColor = {
    default: 'bg-gray-600 dark:bg-gray-300',
    primary: 'bg-blue-600',
    secondary: 'bg-gray-500',
    white: 'bg-white',
  }[variant];

  return (
    <div className={cn('flex items-center gap-1', className)} role="status">
      <div
        className={cn(
          'rounded-full animate-bounce',
          dotSize,
          dotColor
        )}
        style={{ animationDelay: '0ms' }}
      />
      <div
        className={cn(
          'rounded-full animate-bounce',
          dotSize,
          dotColor
        )}
        style={{ animationDelay: '150ms' }}
      />
      <div
        className={cn(
          'rounded-full animate-bounce',
          dotSize,
          dotColor
        )}
        style={{ animationDelay: '300ms' }}
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Pulse Spinner
 * 
 * Pulsing circle
 * 
 * @example
 * ```tsx
 * <PulseSpinner />
 * ```
 */
export function PulseSpinner({
  size = 'md',
  variant = 'default',
  className,
}: DotsSpinnerProps) {
  const pulseColor = {
    default: 'bg-gray-600 dark:bg-gray-300',
    primary: 'bg-blue-600',
    secondary: 'bg-gray-500',
    white: 'bg-white',
  }[variant];

  return (
    <div
      className={cn(
        'rounded-full animate-pulse',
        sizeClasses[size].split(' ').slice(0, 2).join(' '), // Just h-X w-X
        pulseColor,
        className
      )}
      role="status"
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Loading Overlay
 * 
 * Full-page or container loading overlay
 * 
 * @example
 * ```tsx
 * <LoadingOverlay message="Loading payment links..." />
 * ```
 */
export interface LoadingOverlayProps {
  /** Loading message */
  message?: string;
  /** Show backdrop */
  backdrop?: boolean;
  /** Spinner size */
  size?: SpinnerSize;
  /** Full screen or container */
  fullScreen?: boolean;
  className?: string;
}

export function LoadingOverlay({
  message,
  backdrop = true,
  size = 'lg',
  fullScreen = false,
  className,
}: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        fullScreen ? 'fixed inset-0' : 'absolute inset-0',
        backdrop && 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
        'z-50',
        className
      )}
    >
      <Spinner size={size} variant="primary" />
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Inline Loader
 * 
 * Small inline loading indicator
 * 
 * @example
 * ```tsx
 * <button disabled>
 *   <InlineLoader /> Saving...
 * </button>
 * ```
 */
export interface InlineLoaderProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
}

export function InlineLoader({
  size = 'sm',
  variant = 'default',
  className,
}: InlineLoaderProps) {
  return (
    <Spinner
      size={size}
      variant={variant}
      className={cn('inline-block', className)}
    />
  );
}

/**
 * Button Spinner
 * 
 * Spinner specifically sized for buttons
 * 
 * @example
 * ```tsx
 * <button disabled>
 *   <ButtonSpinner /> Loading...
 * </button>
 * ```
 */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Spinner
      size="sm"
      variant="white"
      className={cn('mr-2', className)}
    />
  );
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Basic Spinner:
 * ```tsx
 * <Spinner size="md" variant="primary" />
 * ```
 * 
 * Dots Spinner:
 * ```tsx
 * <DotsSpinner size="lg" variant="primary" />
 * ```
 * 
 * Loading Overlay:
 * ```tsx
 * {isLoading && (
 *   <LoadingOverlay
 *     message="Loading payment links..."
 *     fullScreen
 *   />
 * )}
 * ```
 * 
 * In Button:
 * ```tsx
 * <button disabled={isLoading}>
 *   {isLoading && <ButtonSpinner />}
 *   {isLoading ? 'Saving...' : 'Save'}
 * </button>
 * ```
 * 
 * Inline:
 * ```tsx
 * <div>
 *   <InlineLoader /> Loading data...
 * </div>
 * ```
 */







