'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AgreementIntelligenceIndexScreen } from '@/components/journey/lovable/agreement-intelligence-index-screen';
import { ReferralManagementHubScreen } from '@/components/journey/lovable/referral-management-hub-screen';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';

export function WorkflowInstanceScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const template = getWorkflowBySlug(slug);
  const { isInstalled, loading } = useDeployedWorkflows();

  useEffect(() => {
    if (loading || !template?.template.deployable) return;
    if (!isInstalled(slug)) {
      router.replace(COMMERCIAL_OS_ROUTES.workflowDetail(slug));
    }
  }, [isInstalled, loading, router, slug, template]);

  if (!template) {
    return null;
  }

  if (loading) {
    return (
      <div className="animate-fade-up py-16 text-center text-[13px] text-ink-soft">
        Loading workflow…
      </div>
    );
  }

  if (!isInstalled(slug)) {
    return null;
  }

  if (slug === 'agreement-intelligence') {
    return <AgreementIntelligenceIndexScreen />;
  }

  if (slug === 'referral-management') {
    return <ReferralManagementHubScreen />;
  }

  return (
    <div className="animate-fade-up rounded-2xl border border-border bg-card p-8 shadow-card">
      <h1 className="text-xl font-semibold">{template.name}</h1>
      <p className="mt-2 text-[14px] text-ink-soft">
        This workflow is installed. Its operating surface is not available yet.
      </p>
    </div>
  );
}
