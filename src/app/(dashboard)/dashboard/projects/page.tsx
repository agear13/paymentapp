export const dynamic = 'force-dynamic';

import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { ProjectsWorkspaceIndex } from '@/components/projects/projects-workspace-index';

export default async function ProjectsPage() {
  const productProfile = await getDashboardProductProfile();
  return <ProjectsWorkspaceIndex productProfile={productProfile} />;
}
