/**
 * Toast Hook
 * Wrapper around Sonner toast for consistent API
 *
 * The returned `toast` function is stable across renders so it is safe to omit from
 * useCallback/useEffect dependency arrays (unstable toast caused infinite refetch loops).
  */

import * as React from 'react';
import { toast as sonnerToast } from 'sonner';

export interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

export const useToast = () => {
  const toast = React.useCallback(({ title, description, variant = 'default' }: ToastProps) => {
    switch (variant) {
      case 'destructive':
        sonnerToast.error(title, description ? { description } : undefined);
        break;
      case 'success':
        sonnerToast.success(title, description ? { description } : undefined);
        break;
      default:
        sonnerToast(title, description ? { description } : undefined);
        break;
    }
  }, []);

  return { toast };
};

// Re-export sonner toast for direct usage
export { toast } from 'sonner';













