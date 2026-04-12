'use client';

import * as React from 'react';
import {
  copilotInitialState,
  copilotReducer,
  type CopilotAction,
} from '@/lib/copilot/copilot-reducer';
import type { CopilotContextPayload, CopilotState } from '@/lib/copilot/copilot-types';
import {
  getMockAssistantResponse,
  getMockComposerReply,
  getMockPendingActionResult,
} from '@/lib/copilot/copilot-mock-responses';

type CopilotContextValue = {
  state: CopilotState;
  dispatch: React.Dispatch<CopilotAction>;
  setCopilotContext: (payload: CopilotContextPayload) => void;
  setOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setCollapsed: (isCollapsed: boolean) => void;
  toggleCollapsed: () => void;
  applySuggestion: (suggestion: string) => void;
  sendComposerMessage: (text: string) => void;
  confirmAction: (actionId: string) => void;
  cancelAction: (actionId: string) => void;
};

const CopilotContext = React.createContext<CopilotContextValue | null>(null);

export function ProvvyCopilotProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(copilotReducer, copilotInitialState);
  const screenRef = React.useRef(state.screen);
  React.useEffect(() => {
    screenRef.current = state.screen;
  }, [state.screen]);

  const setCopilotContext = React.useCallback((payload: CopilotContextPayload) => {
    dispatch({ type: 'SET_CONTEXT', payload });
  }, []);

  const setOpen = React.useCallback((isOpen: boolean) => {
    dispatch({ type: 'SET_OPEN', isOpen });
  }, []);

  const toggleOpen = React.useCallback(() => {
    dispatch({ type: 'TOGGLE_OPEN' });
  }, []);

  const setCollapsed = React.useCallback((isCollapsed: boolean) => {
    dispatch({ type: 'SET_COLLAPSED', isCollapsed });
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    dispatch({ type: 'TOGGLE_COLLAPSED' });
  }, []);

  const runAssistantReply = React.useCallback(
    (apply: () => void) => {
      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_ERROR', error: null });
      window.setTimeout(() => {
        apply();
        dispatch({ type: 'SET_LOADING', loading: false });
      }, 380);
    },
    [],
  );

  const applySuggestion = React.useCallback(
    (suggestion: string) => {
      dispatch({ type: 'ADD_USER_MESSAGE', content: suggestion });
      runAssistantReply(() => {
        const mock = getMockAssistantResponse(suggestion, screenRef.current);
        dispatch({
          type: 'ADD_ASSISTANT_MESSAGE',
          message: { role: 'assistant', blocks: mock.blocks },
          pendingAction: mock.pendingAction ?? null,
        });
      });
    },
    [runAssistantReply],
  );

  const sendComposerMessage = React.useCallback(
    (text: string) => {
      dispatch({ type: 'ADD_USER_MESSAGE', content: text });
      runAssistantReply(() => {
        const mock = getMockComposerReply(text);
        dispatch({
          type: 'ADD_ASSISTANT_MESSAGE',
          message: { role: 'assistant', blocks: mock.blocks },
          pendingAction: mock.pendingAction ?? null,
        });
      });
    },
    [runAssistantReply],
  );

  const confirmAction = React.useCallback(
    (actionId: string) => {
      if (state.pendingAction?.id !== actionId) return;
      const pending = state.pendingAction;
      dispatch({ type: 'MARK_ACTION_COMPLETE', actionId });
      const mock = getMockPendingActionResult(pending);
      dispatch({
        type: 'ADD_ASSISTANT_MESSAGE',
        message: { role: 'assistant', blocks: mock.blocks },
        pendingAction: null,
      });
    },
    [state.pendingAction],
  );

  const cancelAction = React.useCallback(
    (actionId: string) => {
      if (state.pendingAction?.id !== actionId) return;
      dispatch({ type: 'MARK_ACTION_CANCELLED', actionId });
      dispatch({
        type: 'ADD_ASSISTANT_MESSAGE',
        message: {
          role: 'assistant',
          blocks: [{ type: 'text', content: 'Action cancelled. Nothing was changed.' }],
        },
        pendingAction: null,
      });
    },
    [state.pendingAction],
  );

  const value = React.useMemo(
    () => ({
      state,
      dispatch,
      setCopilotContext,
      setOpen,
      toggleOpen,
      setCollapsed,
      toggleCollapsed,
      applySuggestion,
      sendComposerMessage,
      confirmAction,
      cancelAction,
    }),
    [
      state,
      setCopilotContext,
      setOpen,
      toggleOpen,
      setCollapsed,
      toggleCollapsed,
      applySuggestion,
      sendComposerMessage,
      confirmAction,
      cancelAction,
    ],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useProvvyCopilot(): CopilotContextValue {
  const ctx = React.useContext(CopilotContext);
  if (!ctx) {
    throw new Error('useProvvyCopilot must be used within ProvvyCopilotProvider');
  }
  return ctx;
}

/** Convenience for pages: only context setter, avoids re-renders on full state if split later. */
export function useSetCopilotContext(): Pick<CopilotContextValue, 'setCopilotContext'> {
  const { setCopilotContext } = useProvvyCopilot();
  return { setCopilotContext };
}
