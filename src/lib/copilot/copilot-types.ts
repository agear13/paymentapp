/**
 * Provvypay Copilot — shared types for panel state and structured assistant output.
 */

export type CopilotScreenContext =
  | 'payment_links'
  | 'payment_link_detail'
  | 'deal_network'
  | 'deal_detail'
  | 'merchant_settings'
  | 'unknown';

export type CopilotEntityContext = {
  type?: string;
  id?: string;
  label?: string;
} | null;

export type DiagnosticSeverity = 'info' | 'warning' | 'critical';

export type DiagnosticItem = {
  id: string;
  label: string;
  detail?: string;
  severity?: DiagnosticSeverity;
};

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export type AssistantTextBlock = {
  type: 'text';
  content: string;
};

export type AssistantDiagnosticBlock = {
  type: 'diagnostic';
  title: string;
  summary?: string;
  items: DiagnosticItem[];
};

export type AssistantChecklistBlock = {
  type: 'checklist';
  title: string;
  items: ChecklistItem[];
};

export type AssistantWarningBlock = {
  type: 'warning';
  title: string;
  message: string;
};

export type AssistantActionConfirmBlock = {
  type: 'action_confirm';
  actionId: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type AssistantActionResultBlock = {
  type: 'action_result';
  title: string;
  message: string;
  success: boolean;
};

export type AssistantStructuredBlock =
  | AssistantTextBlock
  | AssistantDiagnosticBlock
  | AssistantChecklistBlock
  | AssistantWarningBlock
  | AssistantActionConfirmBlock
  | AssistantActionResultBlock;

export type CopilotUserMessage = {
  id: string;
  role: 'user';
  content: string;
  createdAt: number;
};

export type CopilotAssistantMessage = {
  id: string;
  role: 'assistant';
  createdAt: number;
  blocks: AssistantStructuredBlock[];
};

export type CopilotMessage = CopilotUserMessage | CopilotAssistantMessage;

export type PendingAction = {
  id: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Echo of screen/entity for mocked confirmation copy */
  contextHint?: string;
};

export type CopilotState = {
  isOpen: boolean;
  isCollapsed: boolean;
  screen: CopilotScreenContext;
  entity: CopilotEntityContext;
  messages: CopilotMessage[];
  suggestions: string[];
  loading: boolean;
  pendingAction: PendingAction | null;
  /** Action IDs the user already confirmed (hides stale confirm CTAs in history). */
  completedActionIds: string[];
  /** Action IDs dismissed without running. */
  cancelledActionIds: string[];
  error: string | null;
};

export type CopilotContextPayload = {
  screen: CopilotScreenContext;
  entity?: CopilotEntityContext;
};
