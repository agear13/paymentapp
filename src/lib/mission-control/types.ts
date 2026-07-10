import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';

export const WORKSPACE_TASK_SEVERITIES = ['high', 'medium', 'low'] as const;
export type WorkspaceTaskSeverity = (typeof WORKSPACE_TASK_SEVERITIES)[number];

export const WORKSPACE_TASK_STATUSES = [
  'needs_attention',
  'ready',
  'blocked',
  'overdue',
  'completed',
] as const;
export type WorkspaceTaskStatus = (typeof WORKSPACE_TASK_STATUSES)[number];

export type WorkspaceTaskEntityType =
  | 'project'
  | 'participant'
  | 'payment_link'
  | 'invoice'
  | 'settlement'
  | 'workspace'
  | 'timeline'
  | 'accounting';

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string;
  severity: WorkspaceTaskSeverity;
  dueDate: string | null;
  projectId: string | null;
  entityType: WorkspaceTaskEntityType;
  entityId: string | null;
  recommendedAction: string;
  href: string | null;
  reason: string;
  status: WorkspaceTaskStatus;
};

export type WorkspaceTasksBySeverity = {
  high: WorkspaceTask[];
  medium: WorkspaceTask[];
  low: WorkspaceTask[];
};

export type ProjectAttentionItem = {
  projectId: string;
  projectName: string;
  commercialHealth: string;
  reason: string;
  recommendedAction: string;
  href: string;
  urgency: number;
};

export type BusinessHealthCardId =
  | 'commercial_position'
  | 'cash_readiness'
  | 'forecast_surplus'
  | 'projects_active'
  | 'projects_at_risk'
  | 'settlement_waiting'
  | 'accounting_synced';

export type BusinessHealthCard = {
  id: BusinessHealthCardId;
  label: string;
  value: string;
  detail: string | null;
  status: 'healthy' | 'attention' | 'blocked' | 'neutral';
  timelineHref: string;
};

export type MissionControlDerived = {
  tasks: WorkspaceTask[];
  tasksBySeverity: WorkspaceTasksBySeverity;
  projectAttention: ProjectAttentionItem[];
  businessHealthCards: BusinessHealthCard[];
  timelinePreview: WorkspaceTimelineEvent[];
  recommendations: string[];
};

export type WorkspaceTaskEngineInput = {
  business: BusinessFinancialSnapshot | null;
  timelineEvents: WorkspaceTimelineEvent[];
  healthSnapshots: AgreementHealthSnapshot[];
  currentDate?: string;
};
