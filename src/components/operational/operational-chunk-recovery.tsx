'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { BUILD_ID } from '@/generated/build-info';
import {
  clearChunkReloadAttempt,
  decideChunkRecovery,
  isChunkLoadError,
  isScriptChunkError,
  logChunkRecoveryError,
  markChunkReloadAttempted,
  OPERATIONAL_WORKSPACE_UPDATING_MESSAGE,
  type ChunkRecoveryState,
} from '@/lib/operational/chunk-recovery';

const INITIAL_STATE: ChunkRecoveryState = {
  phase: 'idle',
  message: '',
};

export function OperationalChunkRecovery({ scope = 'operational-dashboard' }: { scope?: string }) {
  const [state, setState] = React.useState<ChunkRecoveryState>(INITIAL_STATE);
  const recoveringRef = React.useRef(false);

  const recover = React.useCallback(
    async (error: unknown) => {
      if (recoveringRef.current) return;
      if (!isChunkLoadError(error)) return;

      recoveringRef.current = true;
      logChunkRecoveryError(error, scope);

      const decision = await decideChunkRecovery(error, BUILD_ID);
      if (decision.action === 'fail') {
        recoveringRef.current = false;
        if (decision.reason === 'already_retried') {
          setState({
            phase: 'failed',
            message:
              'The operational workspace could not finish loading. Please hard-refresh or try again in a moment.',
          });
        }
        return;
      }

      setState({ phase: 'recovering', message: OPERATIONAL_WORKSPACE_UPDATING_MESSAGE });
      markChunkReloadAttempted();

      window.setTimeout(() => {
        window.location.reload();
      }, 400);
    },
    [scope]
  );

  React.useEffect(() => {
    clearChunkReloadAttempt();

    const onError = (event: ErrorEvent) => {
      if (isScriptChunkError(event)) {
        void recover(new Error(`Script chunk failed: ${(event.target as HTMLScriptElement).src}`));
        return;
      }
      if (event.error) void recover(event.error);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      void recover(event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [recover]);

  if (state.phase === 'idle') return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-4 max-w-md rounded-lg border bg-card p-6 text-center shadow-lg">
        {state.phase === 'recovering' ? (
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" aria-hidden />
        ) : null}
        <p className="text-base font-medium text-foreground">{state.message}</p>
        {state.phase === 'failed' ? (
          <button
            type="button"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload workspace
          </button>
        ) : null}
      </div>
    </div>
  );
}
