/**
 * Media Query Hook
 * 
 * Detect responsive breakpoints and media queries
 */

import { useState, useEffect } from 'react';

/**
 * useMediaQuery Hook
 * 
 * Returns true if the media query matches
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *   const isDesktop = useMediaQuery('(min-width: 1024px)');
 *   
 *   return isMobile ? <MobileView /> : <DesktopView />;
 * }
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    media.addEventListener('change', listener);

    // Cleanup
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/**
 * useBreakpoint Hook
 * 
 * Returns current breakpoint (mobile, tablet, desktop)
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const breakpoint = useBreakpoint();
 *   
 *   return (
 *     <div>
 *       Current breakpoint: {breakpoint}
 *     </div>
 *   );
 * }
 * ```
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

/**
 * useIsMobile Hook
 * 
 * Returns true if device is mobile
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const isMobile = useIsMobile();
 *   
 *   return isMobile ? <MobileNav /> : <DesktopNav />;
 * }
 * ```
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/**
 * useIsTablet Hook
 * 
 * Returns true if device is tablet
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * useIsDesktop Hook
 * 
 * Returns true if device is desktop
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * useTouchDevice Hook
 * 
 * Returns true if device supports touch
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouch;
}

/**
 * useOrientation Hook
 * 
 * Returns current screen orientation
 */
export type Orientation = 'portrait' | 'landscape';

export function useOrientation(): Orientation {
  const isPortrait = useMediaQuery('(orientation: portrait)');
  return isPortrait ? 'portrait' : 'landscape';
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Responsive Component:
 * ```tsx
 * function Dashboard() {
 *   const isMobile = useIsMobile();
 *   const isTablet = useIsTablet();
 *   const isDesktop = useIsDesktop();
 *   
 *   return (
 *     <div>
 *       {isMobile && <MobileDashboard />}
 *       {isTablet && <TabletDashboard />}
 *       {isDesktop && <DesktopDashboard />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * Conditional Rendering:
 * ```tsx
 * function PaymentLinkCard() {
 *   const isMobile = useIsMobile();
 *   
 *   return (
 *     <Card>
 *       {isMobile ? (
 *         <CompactView />
 *       ) : (
 *         <FullView />
 *       )}
 *     </Card>
 *   );
 * }
 * ```
 * 
 * Touch Detection:
 * ```tsx
 * function InteractiveElement() {
 *   const isTouch = useTouchDevice();
 *   
 *   return (
 *     <button
 *       className={isTouch ? 'touch-target-large' : 'touch-target-normal'}
 *     >
 *       Click Me
 *     </button>
 *   );
 * }
 * ```
 * 
 * Orientation:
 * ```tsx
 * function VideoPlayer() {
 *   const orientation = useOrientation();
 *   
 *   return (
 *     <div className={orientation === 'landscape' ? 'fullscreen' : 'normal'}>
 *       <video />
 *     </div>
 *   );
 * }
 * ```
 */







