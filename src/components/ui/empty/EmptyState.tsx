/**
 * Empty State Components
 * 
 * Beautiful empty states with illustrations and calls-to-action
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Empty State
 * 
 * Generic empty state component
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<InboxIcon />}
 *   title="No payment links yet"
 *   description="Create your first payment link to get started"
 *   action={<button>Create Payment Link</button>}
 * />
 * ```
 */
export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: React.ReactNode;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Call-to-action button or element */
  action?: React.ReactNode;
  /** Secondary action */
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-12',
        className
      )}
    >
      {icon && (
        <div className="mb-6 text-gray-400 dark:text-gray-600">
          {icon}
        </div>
      )}

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/**
 * No Payment Links Empty State
 */
export function NoPaymentLinks({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-24 h-24"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
      title="No payment links yet"
      description="Create your first payment link to start accepting crypto payments. It only takes a few seconds!"
      action={
        onCreate && (
          <button
            onClick={onCreate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Payment Link
          </button>
        )
      }
      secondaryAction={
        <a
          href="/docs"
          className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          Learn More
        </a>
      }
    />
  );
}

/**
 * No Transactions Empty State
 */
export function NoTransactions() {
  return (
    <EmptyState
      icon={
        <svg
          className="w-24 h-24"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      }
      title="No transactions yet"
      description="Your transactions will appear here once customers start making payments."
    />
  );
}

/**
 * No Search Results Empty State
 */
export function NoSearchResults({
  query,
  onClear,
}: {
  query?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-24 h-24"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      title={query ? `No results for "${query}"` : 'No results found'}
      description="Try adjusting your search or filter to find what you're looking for."
      action={
        onClear && (
          <button
            onClick={onClear}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Clear Search
          </button>
        )
      }
    />
  );
}

/**
 * No Data Empty State
 */
export function NoData({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-24 h-24"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      }
      title="No data available"
      description={message || 'There is no data to display at this time.'}
    />
  );
}

/**
 * Connection Error Empty State
 */
export function ConnectionError({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-24 h-24 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
      }
      title="Connection Error"
      description="Unable to load data. Please check your internet connection and try again."
      action={
        onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Retry
          </button>
        )
      }
    />
  );
}

/**
 * Coming Soon Empty State
 */
export function ComingSoon({ feature }: { feature?: string }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-24 h-24"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      title="Coming Soon"
      description={
        feature
          ? `${feature} is coming soon! We're working hard to bring you this feature.`
          : "We're working hard to bring you this feature."
      }
    />
  );
}

/**
 * Onboarding Empty State
 */
export function OnboardingState({
  title,
  steps,
  currentStep,
}: {
  title: string;
  steps: Array<{ title: string; description: string; action?: () => void }>;
  currentStep: number;
}) {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Follow these steps to get started
        </p>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={index}
              className={cn(
                'relative pl-12 pb-6 border-l-2',
                isCompleted
                  ? 'border-green-500'
                  : isCurrent
                  ? 'border-blue-500'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* Step Number/Icon */}
              <div
                className={cn(
                  'absolute left-[-13px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold',
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Step Content */}
              <div className={cn(isCurrent && 'font-medium')}>
                <h3
                  className={cn(
                    'text-lg mb-2',
                    isCompleted
                      ? 'text-gray-500 dark:text-gray-500 line-through'
                      : 'text-gray-900 dark:text-white'
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cn(
                    'text-sm',
                    isCompleted
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-600 dark:text-gray-400'
                  )}
                >
                  {step.description}
                </p>

                {isCurrent && step.action && (
                  <button
                    onClick={step.action}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * No Payment Links:
 * ```tsx
 * {paymentLinks.length === 0 && (
 *   <NoPaymentLinks onCreate={() => router.push('/create')} />
 * )}
 * ```
 * 
 * No Search Results:
 * ```tsx
 * {filteredLinks.length === 0 && (
 *   <NoSearchResults
 *     query={searchQuery}
 *     onClear={() => setSearchQuery('')}
 *   />
 * )}
 * ```
 * 
 * Connection Error:
 * ```tsx
 * {error && (
 *   <ConnectionError onRetry={() => refetch()} />
 * )}
 * ```
 * 
 * Custom Empty State:
 * ```tsx
 * <EmptyState
 *   icon={<CustomIcon />}
 *   title="Custom Title"
 *   description="Custom description"
 *   action={<button>Action</button>}
 * />
 * ```
 * 
 * Onboarding:
 * ```tsx
 * <OnboardingState
 *   title="Welcome to Payment Links"
 *   steps={[
 *     {
 *       title: 'Connect Wallet',
 *       description: 'Connect your Hedera wallet',
 *       action: () => connectWallet(),
 *     },
 *     {
 *       title: 'Create Link',
 *       description: 'Create your first payment link',
 *       action: () => router.push('/create'),
 *     },
 *   ]}
 *   currentStep={0}
 * />
 * ```
 */







