/**
 * Toast Hook
 * Wrapper around Sonner toast for consistent API
 */

import { toast as sonnerToast } from 'sonner';

export interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

export const useToast = () => {
  const toast = ({ title, description, variant = 'default' }: ToastProps) => {
    const message = description ? `${title}: ${description}` : title;

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
  };

  return { toast };
};

// Re-export sonner toast for direct usage
export { toast } from 'sonner';













