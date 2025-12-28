/**
 * Progress Bar Components
 * 
 * Visual progress indicators for long-running operations
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Progress Bar
 * 
 * Linear progress indicator
 * 
 * @example
 * ```tsx
 * <ProgressBar value={75} max={100} />
 * ```
 */
export interface ProgressBarProps {
  /** Current progress value */
  value: number;
  /** Maximum value */
  max?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** Additional className */
  className?: string;
  /** Accessible label */
  label?: string;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const variantClasses = {
  default: 'bg-gray-600 dark:bg-gray-400',
  primary: 'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  danger: 'bg-red-600',
};

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  variant = 'primary',
  className,
  label = 'Progress',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-in-out',
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Indeterminate Progress Bar
 * 
 * Progress bar with unknown duration
 * 
 * @example
 * ```tsx
 * <IndeterminateProgressBar />
 * ```
 */
export interface IndeterminateProgressBarProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  label?: string;
}

export function IndeterminateProgressBar({
  size = 'md',
  variant = 'primary',
  className,
  label = 'Loading',
}: IndeterminateProgressBarProps) {
  return (
    <div
      className={cn(
        'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
        sizeClasses[size],
        className
      )}
      role="progressbar"
      aria-label={label}
      aria-busy="true"
    >
      <div
        className={cn(
          'h-full rounded-full animate-progress',
          variantClasses[variant]
        )}
        style={{
          width: '30%',
          animation: 'progress 1.5s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/**
 * Circular Progress
 * 
 * Circular progress indicator
 * 
 * @example
 * ```tsx
 * <CircularProgress value={75} size={100} />
 * ```
 */
export interface CircularProgressProps {
  /** Current progress value */
  value: number;
  /** Maximum value */
  max?: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Show percentage in center */
  showLabel?: boolean;
  /** Color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const circularVariantColors = {
  default: '#4B5563', // gray-600
  primary: '#2563EB', // blue-600
  success: '#16A34A', // green-600
  warning: '#CA8A04', // yellow-600
  danger: '#DC2626', // red-600
};

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
  variant = 'primary',
  className,
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={circularVariantColors[variant]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Step Progress
 * 
 * Multi-step progress indicator
 * 
 * @example
 * ```tsx
 * <StepProgress
 *   steps={['Details', 'Payment', 'Confirm']}
 *   currentStep={1}
 * />
 * ```
 */
export interface StepProgressProps {
  /** Step labels */
  steps: string[];
  /** Current step index (0-based) */
  currentStep: number;
  /** Completed steps (optional, defaults to all before current) */
  completedSteps?: number[];
  className?: string;
}

export function StepProgress({
  steps,
  currentStep,
  completedSteps,
  className,
}: StepProgressProps) {
  const isCompleted = (index: number) => {
    if (completedSteps) {
      return completedSteps.includes(index);
    }
    return index < currentStep;
  };

  const isCurrent = (index: number) => index === currentStep;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* Step */}
            <div className="flex flex-col items-center flex-1">
              {/* Circle */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors',
                  {
                    'bg-blue-600 text-white': isCurrent(index),
                    'bg-green-600 text-white': isCompleted(index),
                    'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400':
                      !isCurrent(index) && !isCompleted(index),
                  }
                )}
              >
                {isCompleted(index) ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-sm font-medium',
                  {
                    'text-blue-600': isCurrent(index),
                    'text-green-600': isCompleted(index),
                    'text-gray-500 dark:text-gray-400':
                      !isCurrent(index) && !isCompleted(index),
                  }
                )}
              >
                {step}
              </span>
            </div>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-1 flex-1 mx-2 transition-colors',
                  isCompleted(index)
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Linear Progress:
 * ```tsx
 * <ProgressBar
 *   value={75}
 *   max={100}
 *   showLabel
 *   variant="primary"
 * />
 * ```
 * 
 * Indeterminate:
 * ```tsx
 * <IndeterminateProgressBar
 *   variant="primary"
 *   label="Processing..."
 * />
 * ```
 * 
 * Circular:
 * ```tsx
 * <CircularProgress
 *   value={75}
 *   size={120}
 *   showLabel
 *   variant="success"
 * />
 * ```
 * 
 * Steps:
 * ```tsx
 * <StepProgress
 *   steps={['Account', 'Payment', 'Confirm']}
 *   currentStep={1}
 * />
 * ```
 * 
 * File Upload:
 * ```tsx
 * function FileUpload() {
 *   const [progress, setProgress] = useState(0);
 *   
 *   return (
 *     <div>
 *       <p>Uploading file...</p>
 *       <ProgressBar
 *         value={progress}
 *         showLabel
 *         variant="primary"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

// Add custom animation to global CSS
export const progressAnimationCSS = `
@keyframes progress {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(400%);
  }
  100% {
    transform: translateX(-100%);
  }
}

.animate-progress {
  animation: progress 1.5s ease-in-out infinite;
}
`;







