'use client';

import { AgreementIntelligenceBriefing } from '@/components/agreements/briefing/agreement-intelligence-briefing';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  return <AgreementIntelligenceBriefing projectId={projectId} />;
}
