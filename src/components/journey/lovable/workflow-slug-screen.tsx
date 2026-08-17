'use client';

import { WorkflowDetailScreen } from '@/components/journey/lovable/workflow-detail-screen';
import { AgreementIntelligenceHubScreen } from '@/components/journey/lovable/agreement-intelligence-hub-screen';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';

export function WorkflowSlugScreen({ slug }: { slug: string }) {
  const template = getWorkflowBySlug(slug);
  const { isInstalled, loading } = useDeployedWorkflows();

  if (!template) {
    return null;
  }

  if (template.template.deployable && slug === 'agreement-intelligence' && !loading && isInstalled(slug)) {
    return <AgreementIntelligenceHubScreen />;
  }

  return <WorkflowDetailScreen slug={slug} />;
}
