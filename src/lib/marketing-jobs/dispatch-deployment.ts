import type { DispatchDeploymentStep } from '@/lib/marketing-jobs/types';

export const DISPATCH_DEPLOYMENT_STEPS: Omit<DispatchDeploymentStep, 'status'>[] = [
  { id: 'packaging', label: 'Packaging files' },
  { id: 'compressing', label: 'Compressing campaign' },
  { id: 'company-brain', label: 'Preparing Company Brain' },
  { id: 'manifest', label: 'Generating dispatch manifest' },
  { id: 'dispatching', label: 'Dispatching to AI Creative Team' },
  { id: 'production', label: 'Creative Production Started' },
];

export function buildInitialDispatchSteps(): DispatchDeploymentStep[] {
  return DISPATCH_DEPLOYMENT_STEPS.map((step) => ({
    ...step,
    status: 'pending',
  }));
}

export function advanceDispatchSteps(
  steps: DispatchDeploymentStep[],
  completedCount: number
): DispatchDeploymentStep[] {
  return steps.map((step, index) => {
    if (index < completedCount) return { ...step, status: 'complete' };
    if (index === completedCount) return { ...step, status: 'active' };
    return { ...step, status: 'pending' };
  });
}
