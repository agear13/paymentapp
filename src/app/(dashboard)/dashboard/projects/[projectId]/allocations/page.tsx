import { redirect } from 'next/navigation';
import { projectCommercialRolesPath } from '@/lib/projects/project-routes';

type PageProps = {
  params: Promise<{ projectId: string }>;
};

/** Legacy path → commercial roles tab */
export default async function ProjectAllocationsRedirectPage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(projectCommercialRolesPath(projectId));
}
