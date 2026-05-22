import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  deriveWorkspaceOperationalHealth,
  deriveWorkspaceState,
} from '@/lib/operations/readiness/workspace-readiness';
import { orchestrateOperations } from '@/lib/operations/orchestration/operational-orchestrator';

export function selectWorkspaceState(ctx: WorkspaceOperationalContext) {
  return deriveWorkspaceState(ctx);
}

export function selectWorkspaceHealth(ctx: WorkspaceOperationalContext) {
  return deriveWorkspaceOperationalHealth(ctx);
}

export function selectWorkspaceOrchestration(ctx: WorkspaceOperationalContext) {
  return orchestrateOperations({ workspace: ctx });
}
