import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { CommercialWorkspaceOperatorLayout } from '@/components/journey/lovable/commercial-workspace-operator-layout';

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
};

export default async function CommercialWorkspaceOperatorRouteLayout({
  children,
  params,
}: LayoutProps) {
  const { workspaceId } = await params;
  if (!workspaceId.trim()) notFound();

  return (
    <CommercialWorkspaceOperatorLayout workspaceId={workspaceId}>
      {children}
    </CommercialWorkspaceOperatorLayout>
  );
}
