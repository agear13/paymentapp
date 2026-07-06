import type { WorkspaceFeature } from './types';

export type FeatureRegistryItem<TIcon = unknown> = {
  id: string;
  title: string;
  href: string;
  requiredFeature?: WorkspaceFeature;
  icon?: TIcon;
};

export type FeatureRegistryItemWithFeature<TIcon = unknown> = FeatureRegistryItem<TIcon> & {
  requiredFeature: WorkspaceFeature;
};
