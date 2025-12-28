/**
 * Skeleton Loading Components
 * 
 * Provides skeleton screens for better perceived performance.
 * Shows content structure while data is loading.
 * 
 * Benefits:
 * - Better perceived performance
 * - Reduces layout shift
 * - Professional loading experience
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Base Skeleton Component
 * 
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-full" />
 * <Skeleton className="h-12 w-12 rounded-full" />
 * ```
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation variant */
  variant?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'pulse',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-gray-200 dark:bg-gray-700 rounded',
        {
          'animate-pulse': variant === 'pulse',
          'animate-wave': variant === 'wave',
        },
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton Text
 * 
 * Simulates text lines with natural width variation
 * 
 * @example
 * ```tsx
 * <SkeletonText lines={3} />
 * ```
 */
export interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Line height class */
  lineHeight?: string;
  /** Last line width (for natural text appearance) */
  lastLineWidth?: string;
  className?: string;
}

export function SkeletonText({
  lines = 1,
  lineHeight = 'h-4',
  lastLineWidth = 'w-3/4',
  className,
}: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            lineHeight,
            i === lines - 1 ? lastLineWidth : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton Card
 * 
 * Simulates a card layout with image, title, and description
 * 
 * @example
 * ```tsx
 * <SkeletonCard />
 * <SkeletonCard showImage={false} />
 * ```
 */
export interface SkeletonCardProps {
  /** Show image skeleton */
  showImage?: boolean;
  /** Show actions skeleton */
  showActions?: boolean;
  className?: string;
}

export function SkeletonCard({
  showImage = true,
  showActions = true,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'border border-gray-200 dark:border-gray-700 rounded-lg p-6',
        className
      )}
    >
      {showImage && (
        <Skeleton className="h-48 w-full mb-4 rounded-md" />
      )}
      
      {/* Title */}
      <Skeleton className="h-6 w-3/4 mb-3" />
      
      {/* Description */}
      <SkeletonText lines={2} lineHeight="h-4" className="mb-4" />
      
      {/* Metadata */}
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      
      {showActions && (
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton Table
 * 
 * Simulates a table layout with rows and columns
 * 
 * @example
 * ```tsx
 * <SkeletonTable rows={5} columns={4} />
 * ```
 */
export interface SkeletonTableProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show header */
  showHeader?: boolean;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              className="h-5 flex-1"
            />
          ))}
        </div>
      )}
      
      {/* Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-10 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton List
 * 
 * Simulates a list of items
 * 
 * @example
 * ```tsx
 * <SkeletonList items={5} />
 * ```
 */
export interface SkeletonListProps {
  /** Number of items */
  items?: number;
  /** Show avatar */
  showAvatar?: boolean;
  className?: string;
}

export function SkeletonList({
  items = 5,
  showAvatar = true,
  className,
}: SkeletonListProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {showAvatar && (
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Form
 * 
 * Simulates a form layout
 * 
 * @example
 * ```tsx
 * <SkeletonForm fields={4} />
 * ```
 */
export interface SkeletonFormProps {
  /** Number of form fields */
  fields?: number;
  /** Show submit button */
  showSubmit?: boolean;
  className?: string;
}

export function SkeletonForm({
  fields = 4,
  showSubmit = true,
  className,
}: SkeletonFormProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Label */}
          <Skeleton className="h-4 w-24" />
          {/* Input */}
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      
      {showSubmit && (
        <Skeleton className="h-10 w-32" />
      )}
    </div>
  );
}

/**
 * Skeleton Dashboard
 * 
 * Simulates a dashboard layout with stats and charts
 * 
 * @example
 * ```tsx
 * <SkeletonDashboard />
 * ```
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6"
          >
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      
      {/* Chart */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
      
      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <Skeleton className="h-6 w-48 mb-6" />
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}

/**
 * Skeleton Payment Link Card
 * 
 * Specific skeleton for payment link cards
 */
export function SkeletonPaymentLinkCard() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      
      {/* Amount */}
      <Skeleton className="h-10 w-40 mb-4" />
      
      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  );
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Basic Skeleton:
 * ```tsx
 * <Skeleton className="h-4 w-full" />
 * ```
 * 
 * Text Lines:
 * ```tsx
 * <SkeletonText lines={3} />
 * ```
 * 
 * Card:
 * ```tsx
 * <SkeletonCard showImage showActions />
 * ```
 * 
 * Table:
 * ```tsx
 * <SkeletonTable rows={10} columns={5} />
 * ```
 * 
 * List:
 * ```tsx
 * <SkeletonList items={5} showAvatar />
 * ```
 * 
 * Form:
 * ```tsx
 * <SkeletonForm fields={6} showSubmit />
 * ```
 * 
 * Dashboard:
 * ```tsx
 * <SkeletonDashboard />
 * ```
 * 
 * Payment Link Card:
 * ```tsx
 * <SkeletonPaymentLinkCard />
 * ```
 * 
 * In a Component:
 * ```tsx
 * function PaymentLinksList() {
 *   const { data, isLoading } = usePaymentLinks();
 *   
 *   if (isLoading) {
 *     return (
 *       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *         {Array.from({ length: 6 }).map((_, i) => (
 *           <SkeletonPaymentLinkCard key={i} />
 *         ))}
 *       </div>
 *     );
 *   }
 *   
 *   return <div>{/* Actual content *\/}</div>;
 * }
 * ```
 */







