/**
 * Reusable Commercial Network event dispatcher.
 *
 * Local Provider dispatches immediately (synchronous notify).
 * Future providers may enqueue and dispatch asynchronously.
 */

import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';
import type {
  CommercialNetworkEventHandler,
  Unsubscribe,
} from '@/lib/commercial-network/types';

export type EventDispatcherOptions = {
  /**
   * When true (default), handlers run immediately in subscription order.
   * When false, handlers are scheduled via Promise microtasks (still in-process).
   */
  immediate?: boolean;
};

export type CommercialNetworkEventDispatcher = {
  subscribe(handler: CommercialNetworkEventHandler): Unsubscribe;
  dispatch(event: CommercialNetworkEvent): Promise<void>;
  /** Events already dispatched (oldest → newest). Useful for tests. */
  getHistory(): readonly CommercialNetworkEvent[];
  clearHistory(): void;
  listenerCount(): number;
};

export function createCommercialNetworkEventDispatcher(
  options: EventDispatcherOptions = {}
): CommercialNetworkEventDispatcher {
  const immediate = options.immediate !== false;
  const handlers = new Set<CommercialNetworkEventHandler>();
  const history: CommercialNetworkEvent[] = [];

  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    async dispatch(event) {
      history.push(event);
      const snapshot = [...handlers];
      if (immediate) {
        for (const handler of snapshot) {
          await handler(event);
        }
        return;
      }
      await Promise.resolve();
      for (const handler of snapshot) {
        await handler(event);
      }
    },

    getHistory() {
      return history;
    },

    clearHistory() {
      history.length = 0;
    },

    listenerCount() {
      return handlers.size;
    },
  };
}
