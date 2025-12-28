/**
 * Skip Link Component
 * 
 * Allows keyboard users to skip to main content
 * WCAG 2.1: 2.4.1 Bypass Blocks (Level A)
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skip Link
 * 
 * Hidden link that appears on focus for keyboard navigation
 * 
 * @example
 * ```tsx
 * // In layout
 * <body>
 *   <SkipLink href="#main-content" />
 *   <nav>...</nav>
 *   <main id="main-content">...</main>
 * </body>
 * ```
 */
export interface SkipLinkProps {
  /** Target element ID */
  href: string;
  /** Link text */
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({
  href,
  children = 'Skip to main content',
  className,
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Hidden by default
        'sr-only',
        // Visible on focus
        'focus:not-sr-only',
        'focus:absolute focus:top-4 focus:left-4 focus:z-50',
        'focus:px-4 focus:py-2',
        'focus:bg-blue-600 focus:text-white',
        'focus:rounded-lg focus:shadow-lg',
        'focus:outline-none focus:ring-2 focus:ring-blue-400',
        className
      )}
    >
      {children}
    </a>
  );
}

/**
 * Visually Hidden
 * 
 * Hides content visually but keeps it accessible to screen readers
 * 
 * @example
 * ```tsx
 * <button>
 *   <Icon />
 *   <VisuallyHidden>Close dialog</VisuallyHidden>
 * </button>
 * ```
 */
export function VisuallyHidden({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('sr-only', className)}>
      {children}
    </span>
  );
}

/**
 * Focus Visible Indicator
 * 
 * Ensures focus is always visible for keyboard users
 * WCAG 2.1: 2.4.7 Focus Visible (Level AA)
 * 
 * @example
 * ```tsx
 * <button className="focus-visible">
 *   Click me
 * </button>
 * ```
 */
export const focusVisibleStyles = cn(
  'focus:outline-none',
  'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  'dark:focus-visible:ring-blue-400'
);

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Skip to Main Content:
 * ```tsx
 * // In app layout
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SkipLink href="#main-content" />
 *         <Header />
 *         <main id="main-content">{children}</main>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 * 
 * Multiple Skip Links:
 * ```tsx
 * <>
 *   <SkipLink href="#main-content">Skip to content</SkipLink>
 *   <SkipLink href="#nav-menu">Skip to navigation</SkipLink>
 *   <SkipLink href="#footer">Skip to footer</SkipLink>
 * </>
 * ```
 * 
 * Visually Hidden Label:
 * ```tsx
 * <button>
 *   <SearchIcon />
 *   <VisuallyHidden>Search</VisuallyHidden>
 * </button>
 * ```
 * 
 * Icon Button:
 * ```tsx
 * <button aria-label="Close dialog">
 *   <XIcon />
 * </button>
 * ```
 */







