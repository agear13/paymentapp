import type { WorkspaceFeature } from './types';

export type WorkspaceFeatureCollection =
  | ReadonlySet<WorkspaceFeature>
  | readonly WorkspaceFeature[];

export function createWorkspaceFeatureSet(
  enabledFeatures: readonly WorkspaceFeature[]
): ReadonlySet<WorkspaceFeature> {
  return new Set(enabledFeatures);
}

export function hasFeature(
  enabledFeatures: WorkspaceFeatureCollection,
  feature: WorkspaceFeature
): boolean {
  return Array.from(enabledFeatures).includes(feature);
}
