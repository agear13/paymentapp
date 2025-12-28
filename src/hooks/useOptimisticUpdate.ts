/**
 * Optimistic UI Update Hook
 * 
 * Provides optimistic updates for better perceived performance.
 * Updates UI immediately, then syncs with server.
 * 
 * Benefits:
 * - Instant feedback for user actions
 * - Better perceived performance
 * - Automatic rollback on error
 */

import { useState, useCallback, useRef } from 'react';

export interface OptimisticUpdateOptions<T> {
  /** Current data */
  data: T;
  /** Update function (async) */
  updateFn: (optimisticData: T) => Promise<T>;
  /** Rollback function (optional) */
  onRollback?: (error: Error) => void;
  /** Success callback (optional) */
  onSuccess?: (data: T) => void;
}

export interface OptimisticUpdateResult<T> {
  /** Current data (optimistic or actual) */
  data: T;
  /** Is update in progress */
  isUpdating: boolean;
  /** Error if update failed */
  error: Error | null;
  /** Perform optimistic update */
  update: (optimisticData: T) => Promise<void>;
  /** Reset to original data */
  reset: () => void;
}

/**
 * useOptimisticUpdate Hook
 * 
 * @example
 * ```tsx
 * function PaymentLinkCard({ link }) {
 *   const { data, isUpdating, update } = useOptimisticUpdate({
 *     data: link,
 *     updateFn: async (optimisticLink) => {
 *       return await updatePaymentLink(optimisticLink.id, optimisticLink);
 *     },
 *     onRollback: (error) => {
 *       toast.error('Update failed');
 *     },
 *   });
 * 
 *   const handleStatusChange = async (newStatus) => {
 *     await update({ ...data, status: newStatus });
 *   };
 * 
 *   return (
 *     <div>
 *       <span>{data.status}</span>
 *       <button onClick={() => handleStatusChange('ACTIVE')}>
 *         Activate
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOptimisticUpdate<T>({
  data: initialData,
  updateFn,
  onRollback,
  onSuccess,
}: OptimisticUpdateOptions<T>): OptimisticUpdateResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const originalDataRef = useRef<T>(initialData);

  const update = useCallback(
    async (optimisticData: T) => {
      // Store original data for rollback
      originalDataRef.current = data;

      // Apply optimistic update immediately
      setData(optimisticData);
      setIsUpdating(true);
      setError(null);

      try {
        // Perform actual update
        const result = await updateFn(optimisticData);

        // Update with server response
        setData(result);

        if (onSuccess) {
          onSuccess(result);
        }
      } catch (err) {
        // Rollback on error
        setData(originalDataRef.current);
        setError(err as Error);

        if (onRollback) {
          onRollback(err as Error);
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [data, updateFn, onRollback, onSuccess]
  );

  const reset = useCallback(() => {
    setData(originalDataRef.current);
    setError(null);
    setIsUpdating(false);
  }, []);

  return {
    data,
    isUpdating,
    error,
    update,
    reset,
  };
}

/**
 * useOptimisticList Hook
 * 
 * Optimistic updates for lists (add, remove, update items)
 * 
 * @example
 * ```tsx
 * function PaymentLinksList() {
 *   const { items, add, remove, update } = useOptimisticList({
 *     items: paymentLinks,
 *     addFn: createPaymentLink,
 *     removeFn: deletePaymentLink,
 *     updateFn: updatePaymentLink,
 *   });
 * 
 *   return (
 *     <div>
 *       {items.map(link => (
 *         <PaymentLinkCard
 *           key={link.id}
 *           link={link}
 *           onDelete={() => remove(link.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export interface OptimisticListOptions<T extends { id: string }> {
  /** Initial items */
  items: T[];
  /** Add function */
  addFn?: (item: Omit<T, 'id'>) => Promise<T>;
  /** Remove function */
  removeFn?: (id: string) => Promise<void>;
  /** Update function */
  updateFn?: (id: string, updates: Partial<T>) => Promise<T>;
  /** Error callback */
  onError?: (error: Error, operation: 'add' | 'remove' | 'update') => void;
}

export interface OptimisticListResult<T extends { id: string }> {
  /** Current items */
  items: T[];
  /** Is any operation in progress */
  isUpdating: boolean;
  /** Add item optimistically */
  add: (item: Omit<T, 'id'>) => Promise<void>;
  /** Remove item optimistically */
  remove: (id: string) => Promise<void>;
  /** Update item optimistically */
  update: (id: string, updates: Partial<T>) => Promise<void>;
}

export function useOptimisticList<T extends { id: string }>({
  items: initialItems,
  addFn,
  removeFn,
  updateFn,
  onError,
}: OptimisticListOptions<T>): OptimisticListResult<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isUpdating, setIsUpdating] = useState(false);
  const originalItemsRef = useRef<T[]>(initialItems);

  const add = useCallback(
    async (item: Omit<T, 'id'>) => {
      if (!addFn) return;

      // Generate temporary ID
      const tempId = `temp-${Date.now()}`;
      const optimisticItem = { ...item, id: tempId } as T;

      // Store original for rollback
      originalItemsRef.current = items;

      // Add optimistically
      setItems((prev) => [optimisticItem, ...prev]);
      setIsUpdating(true);

      try {
        // Perform actual add
        const result = await addFn(item);

        // Replace temp item with real one
        setItems((prev) =>
          prev.map((i) => (i.id === tempId ? result : i))
        );
      } catch (err) {
        // Rollback on error
        setItems(originalItemsRef.current);

        if (onError) {
          onError(err as Error, 'add');
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [items, addFn, onError]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!removeFn) return;

      // Store original for rollback
      originalItemsRef.current = items;

      // Remove optimistically
      setItems((prev) => prev.filter((i) => i.id !== id));
      setIsUpdating(true);

      try {
        // Perform actual remove
        await removeFn(id);
      } catch (err) {
        // Rollback on error
        setItems(originalItemsRef.current);

        if (onError) {
          onError(err as Error, 'remove');
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [items, removeFn, onError]
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>) => {
      if (!updateFn) return;

      // Store original for rollback
      originalItemsRef.current = items;

      // Update optimistically
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
      );
      setIsUpdating(true);

      try {
        // Perform actual update
        const result = await updateFn(id, updates);

        // Update with server response
        setItems((prev) =>
          prev.map((i) => (i.id === id ? result : i))
        );
      } catch (err) {
        // Rollback on error
        setItems(originalItemsRef.current);

        if (onError) {
          onError(err as Error, 'update');
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [items, updateFn, onError]
  );

  return {
    items,
    isUpdating,
    add,
    remove,
    update,
  };
}

/**
 * 🎨 USAGE EXAMPLES
 * 
 * Single Item Update:
 * ```tsx
 * function PaymentLinkStatus({ link }) {
 *   const { data, isUpdating, update } = useOptimisticUpdate({
 *     data: link,
 *     updateFn: async (optimisticLink) => {
 *       return await api.updatePaymentLink(optimisticLink);
 *     },
 *     onRollback: () => {
 *       toast.error('Failed to update status');
 *     },
 *   });
 * 
 *   return (
 *     <select
 *       value={data.status}
 *       onChange={(e) => update({ ...data, status: e.target.value })}
 *       disabled={isUpdating}
 *     >
 *       <option value="ACTIVE">Active</option>
 *       <option value="INACTIVE">Inactive</option>
 *     </select>
 *   );
 * }
 * ```
 * 
 * List Operations:
 * ```tsx
 * function PaymentLinksList() {
 *   const { items, add, remove, update, isUpdating } = useOptimisticList({
 *     items: paymentLinks,
 *     addFn: api.createPaymentLink,
 *     removeFn: api.deletePaymentLink,
 *     updateFn: api.updatePaymentLink,
 *     onError: (error, operation) => {
 *       toast.error(`Failed to ${operation} payment link`);
 *     },
 *   });
 * 
 *   return (
 *     <div>
 *       <button onClick={() => add({ amount: 1000, currency: 'USD' })}>
 *         Add Link
 *       </button>
 *       {items.map(link => (
 *         <div key={link.id}>
 *           <span>{link.amount}</span>
 *           <button onClick={() => remove(link.id)}>Delete</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */







