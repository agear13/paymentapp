/**
 * Accessibility Hooks
 * 
 * React hooks for accessibility features
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * useFocusTrap Hook
 * 
 * Traps focus within a container (e.g., modal, dialog)
 * 
 * @example
 * ```tsx
 * function Modal() {
 *   const ref = useFocusTrap<HTMLDivElement>();
 *   
 *   return (
 *     <div ref={ref} role="dialog">
 *       <input />
 *       <button>Close</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement>(): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    // Get all focusable elements
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = element.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstFocusable?.focus();

    // Trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return ref;
}

/**
 * useKeyboardNav Hook
 * 
 * Enables keyboard navigation (arrow keys)
 * 
 * @example
 * ```tsx
 * function Menu() {
 *   const ref = useKeyboardNav<HTMLDivElement>({
 *     onEscape: () => setIsOpen(false),
 *     orientation: 'vertical',
 *   });
 *   
 *   return (
 *     <div ref={ref} role="menu">
 *       <button role="menuitem">Item 1</button>
 *       <button role="menuitem">Item 2</button>
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseKeyboardNavOptions {
  /** Escape key callback */
  onEscape?: () => void;
  /** Enter key callback */
  onEnter?: (index: number) => void;
  /** Navigation orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Item selector */
  itemSelector?: string;
}

export function useKeyboardNav<T extends HTMLElement>(
  options: UseKeyboardNavOptions = {}
): React.RefObject<T> {
  const {
    onEscape,
    onEnter,
    orientation = 'vertical',
    itemSelector = '[role="menuitem"], button, a',
  } = options;

  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(
        element.querySelectorAll<HTMLElement>(itemSelector)
      );
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

      switch (e.key) {
        case nextKey:
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % items.length;
          items[nextIndex]?.focus();
          break;

        case prevKey:
          e.preventDefault();
          const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
          items[prevIndex]?.focus();
          break;

        case 'Home':
          e.preventDefault();
          items[0]?.focus();
          break;

        case 'End':
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;

        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;

        case 'Enter':
          e.preventDefault();
          onEnter?.(currentIndex);
          break;
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, onEnter, orientation, itemSelector]);

  return ref;
}

/**
 * useAnnounce Hook
 * 
 * Announces messages to screen readers
 * 
 * @example
 * ```tsx
 * function Form() {
 *   const announce = useAnnounce();
 *   
 *   const handleSubmit = async () => {
 *     try {
 *       await submitForm();
 *       announce('Form submitted successfully', 'polite');
 *     } catch (error) {
 *       announce('Form submission failed', 'assertive');
 *     }
 *   };
 *   
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useAnnounce() {
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      announceToScreenReader(message, priority);
    },
    []
  );

  return announce;
}

/**
 * Announce to screen reader
 * 
 * Creates a live region and announces message
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) {
  // Create live region if it doesn't exist
  let liveRegion = document.getElementById('aria-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only'; // Visually hidden
    document.body.appendChild(liveRegion);
  }

  // Update priority if needed
  liveRegion.setAttribute('aria-live', priority);

  // Clear previous message
  liveRegion.textContent = '';

  // Announce new message (with small delay for screen reader)
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 100);
}

/**
 * useReducedMotion Hook
 * 
 * Detects if user prefers reduced motion
 * 
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const prefersReducedMotion = useReducedMotion();
 *   
 *   return (
 *     <div
 *       className={prefersReducedMotion ? 'no-animation' : 'with-animation'}
 *     >
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Focus Trap (Modal):
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const ref = useFocusTrap<HTMLDivElement>();
 *   
 *   if (!isOpen) return null;
 *   
 *   return (
 *     <div ref={ref} role="dialog" aria-modal="true">
 *       <h2>Modal Title</h2>
 *       <input placeholder="Focus trapped here" />
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   );
 * }
 * ```
 * 
 * Keyboard Navigation (Menu):
 * ```tsx
 * function Dropdown() {
 *   const ref = useKeyboardNav<HTMLDivElement>({
 *     onEscape: () => setIsOpen(false),
 *     onEnter: (index) => selectItem(items[index]),
 *     orientation: 'vertical',
 *   });
 *   
 *   return (
 *     <div ref={ref} role="menu">
 *       {items.map(item => (
 *         <button key={item.id} role="menuitem">
 *           {item.label}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 * 
 * Screen Reader Announcements:
 * ```tsx
 * function SearchForm() {
 *   const announce = useAnnounce();
 *   
 *   const handleSearch = (results) => {
 *     announce(`Found ${results.length} results`, 'polite');
 *   };
 *   
 *   return <form>...</form>;
 * }
 * ```
 * 
 * Reduced Motion:
 * ```tsx
 * function AnimatedButton() {
 *   const prefersReducedMotion = useReducedMotion();
 *   
 *   return (
 *     <motion.button
 *       animate={prefersReducedMotion ? false : { scale: [1, 1.1, 1] }}
 *     >
 *       Click Me
 *     </motion.button>
 *   );
 * }
 * ```
 */

// Add React import for useReducedMotion
import React from 'react';







