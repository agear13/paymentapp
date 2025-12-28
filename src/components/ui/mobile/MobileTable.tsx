/**
 * Mobile-Responsive Table Component
 * 
 * Converts tables to card-based layout on mobile devices
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * Mobile Table
 * 
 * Automatically switches between table and card layout based on screen size
 * 
 * @example
 * ```tsx
 * <MobileTable
 *   columns={[
 *     { key: 'amount', label: 'Amount' },
 *     { key: 'status', label: 'Status' },
 *   ]}
 *   data={paymentLinks}
 *   renderCell={(item, column) => item[column.key]}
 * />
 * ```
 */
export interface Column<T> {
  key: keyof T | string;
  label: string;
  className?: string;
  mobileLabel?: string; // Different label for mobile
}

export interface MobileTableProps<T> {
  /** Table columns */
  columns: Column<T>[];
  /** Table data */
  data: T[];
  /** Render cell content */
  renderCell: (item: T, column: Column<T>) => React.ReactNode;
  /** Get row key */
  getRowKey: (item: T) => string;
  /** On row click */
  onRowClick?: (item: T) => void;
  /** Empty state */
  emptyState?: React.ReactNode;
  className?: string;
}

export function MobileTable<T>({
  columns,
  data,
  renderCell,
  getRowKey,
  onRowClick,
  emptyState,
  className,
}: MobileTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  if (isMobile) {
    // Mobile: Card-based layout
    return (
      <div className={cn('space-y-4', className)}>
        {data.map((item) => (
          <div
            key={getRowKey(item)}
            onClick={() => onRowClick?.(item)}
            className={cn(
              'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4',
              onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors'
            )}
          >
            {columns.map((column) => (
              <div
                key={String(column.key)}
                className="flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-4">
                  {column.mobileLabel || column.label}
                </span>
                <span className="text-sm text-gray-900 dark:text-white text-right">
                  {renderCell(item, column)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Traditional table layout
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                  column.className
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr
              key={getRowKey(item)}
              onClick={() => onRowClick?.(item)}
              className={cn(
                onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
              )}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                >
                  {renderCell(item, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 🎨 USAGE EXAMPLE
 * 
 * ```tsx
 * function PaymentLinksList() {
 *   const { data } = usePaymentLinks();
 *   
 *   return (
 *     <MobileTable
 *       columns={[
 *         { key: 'amount', label: 'Amount' },
 *         { key: 'currency', label: 'Currency' },
 *         { key: 'status', label: 'Status', mobileLabel: 'Status' },
 *         { key: 'createdAt', label: 'Created', mobileLabel: 'Date' },
 *       ]}
 *       data={data}
 *       getRowKey={(item) => item.id}
 *       renderCell={(item, column) => {
 *         switch (column.key) {
 *           case 'amount':
 *             return formatCurrency(item.amount, item.currency);
 *           case 'status':
 *             return <StatusBadge status={item.status} />;
 *           case 'createdAt':
 *             return formatDate(item.createdAt);
 *           default:
 *             return item[column.key];
 *         }
 *       }}
 *       onRowClick={(item) => router.push(`/links/${item.id}`)}
 *       emptyState={<NoPaymentLinks />}
 *     />
 *   );
 * }
 * ```
 */







