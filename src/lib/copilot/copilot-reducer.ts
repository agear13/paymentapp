import type {
  CopilotAssistantMessage,
  CopilotContextPayload,
  CopilotMessage,
  CopilotState,
  CopilotUserMessage,
  PendingAction,
} from './copilot-types';
import { getSuggestionsForScreen } from './copilot-suggestions';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const copilotInitialState: CopilotState = {
  isOpen: false,
  isCollapsed: false,
  screen: 'unknown',
  entity: null,
  messages: [],
  suggestions: getSuggestionsForScreen('unknown'),
  loading: false,
  pendingAction: null,
  completedActionIds: [],
  cancelledActionIds: [],
  error: null,
};

export type CopilotAction =
  | { type: 'SET_OPEN'; isOpen: boolean }
  | { type: 'SET_COLLAPSED'; isCollapsed: boolean }
  | { type: 'TOGGLE_OPEN' }
  | { type: 'TOGGLE_COLLAPSED' }
  | { type: 'SET_CONTEXT'; payload: CopilotContextPayload }
  | { type: 'ADD_USER_MESSAGE'; content: string }
  | {
      type: 'ADD_ASSISTANT_MESSAGE';
      message: Omit<CopilotAssistantMessage, 'id' | 'createdAt'>;
      pendingAction?: PendingAction | null;
    }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_PENDING_ACTION'; pendingAction: PendingAction | null }
  | { type: 'MARK_ACTION_COMPLETE'; actionId: string }
  | { type: 'MARK_ACTION_CANCELLED'; actionId: string }
  | { type: 'CLEAR_MESSAGES' };

export function copilotReducer(state: CopilotState, action: CopilotAction): CopilotState {
  switch (action.type) {
    case 'SET_OPEN':
      return { ...state, isOpen: action.isOpen };
    case 'SET_COLLAPSED':
      return { ...state, isCollapsed: action.isCollapsed };
    case 'TOGGLE_OPEN':
      return { ...state, isOpen: !state.isOpen };
    case 'TOGGLE_COLLAPSED':
      return { ...state, isCollapsed: !state.isCollapsed };
    case 'SET_CONTEXT': {
      const entity = action.payload.entity ?? null;
      const screen = action.payload.screen;
      return {
        ...state,
        screen,
        entity,
        suggestions: getSuggestionsForScreen(screen),
        error: null,
      };
    }
    case 'ADD_USER_MESSAGE': {
      const msg: CopilotUserMessage = {
        id: newId('u'),
        role: 'user',
        content: action.content,
        createdAt: Date.now(),
      };
      return { ...state, messages: [...state.messages, msg] };
    }
    case 'ADD_ASSISTANT_MESSAGE': {
      const full: CopilotAssistantMessage = {
        ...action.message,
        id: newId('a'),
        createdAt: Date.now(),
      };
      return {
        ...state,
        messages: [...state.messages, full],
        pendingAction:
          action.pendingAction === undefined ? state.pendingAction : action.pendingAction,
      };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_PENDING_ACTION':
      return { ...state, pendingAction: action.pendingAction };
    case 'MARK_ACTION_COMPLETE':
      if (state.completedActionIds.includes(action.actionId)) return state;
      return {
        ...state,
        completedActionIds: [...state.completedActionIds, action.actionId],
        cancelledActionIds: state.cancelledActionIds.filter((id) => id !== action.actionId),
        pendingAction: state.pendingAction?.id === action.actionId ? null : state.pendingAction,
      };
    case 'MARK_ACTION_CANCELLED':
      if (state.cancelledActionIds.includes(action.actionId)) return state;
      return {
        ...state,
        cancelledActionIds: [...state.cancelledActionIds, action.actionId],
        completedActionIds: state.completedActionIds.filter((id) => id !== action.actionId),
        pendingAction: state.pendingAction?.id === action.actionId ? null : state.pendingAction,
      };
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [] as CopilotMessage[],
        pendingAction: null,
        completedActionIds: [],
        cancelledActionIds: [],
        error: null,
      };
    default:
      return state;
  }
}
