/**
 * Bottom Sheet Component
 * 
 * Mobile-friendly modal that slides up from the bottom
 */

'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bottom Sheet
 * 
 * Slides up from the bottom on mobile, regular modal on desktop
 * 
 * @example
 * ```tsx
 * <BottomSheet
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Filter Options"
 * >
 *   <FilterForm />
 * </BottomSheet>
 * ```
 */
export interface BottomSheetProps {
  /** Is the sheet open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Sheet title */
  title?: string;
  /** Sheet content */
  children: React.ReactNode;
  /** Show close button */
  showClose?: boolean;
  /** Snap points (heights) */
  snapPoints?: ('full' | 'half' | 'auto')[];
  /** Initial snap point */
  initialSnap?: 'full' | 'half' | 'auto';
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  showClose = true,
  snapPoints = ['auto'],
  initialSnap = 'auto',
  className,
}: BottomSheetProps) {
  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const heightClass = {
    full: 'h-[calc(100vh-2rem)] md:h-auto md:max-h-[90vh]',
    half: 'h-[50vh] md:h-auto md:max-h-[90vh]',
    auto: 'h-auto max-h-[90vh]',
  }[initialSnap];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50',
          'md:inset-0 md:flex md:items-center md:justify-center',
          'animate-in slide-in-from-bottom md:fade-in',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        <div
          className={cn(
            'bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl',
            'w-full md:max-w-lg',
            'overflow-hidden shadow-xl',
            heightClass
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle (mobile only) */}
          <div className="md:hidden flex justify-center pt-4 pb-2">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
          </div>

          {/* Header */}
          {(title || showClose) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              {title && (
                <h2
                  id="bottom-sheet-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {title}
                </h2>
              )}
              {showClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Basic:
 * ```tsx
 * function FilterButton() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>
 *         Filters
 *       </button>
 *       
 *       <BottomSheet
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         title="Filter Options"
 *       >
 *         <FilterForm />
 *       </BottomSheet>
 *     </>
 *   );
 * }
 * ```
 * 
 * With Actions:
 * ```tsx
 * <BottomSheet
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Confirm Action"
 * >
 *   <p className="mb-6">Are you sure you want to delete this item?</p>
 *   <div className="flex gap-3">
 *     <button onClick={onClose}>Cancel</button>
 *     <button onClick={handleDelete}>Delete</button>
 *   </div>
 * </BottomSheet>
 * ```
 * 
 * Full Height:
 * ```tsx
 * <BottomSheet
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Details"
 *   initialSnap="full"
 * >
 *   <DetailedContent />
 * </BottomSheet>
 * ```
 */







