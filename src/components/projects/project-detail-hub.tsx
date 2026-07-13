'use client';

import { CommercialOperationsWorkspace } from '@/components/projects/commercial-operations-workspace';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  return <CommercialOperationsWorkspace projectId={projectId} />;
}
