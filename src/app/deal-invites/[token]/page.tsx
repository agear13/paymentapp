import { redirect, notFound } from 'next/navigation';
import { resolveWorkspacePathFromInviteToken } from '@/lib/participant-portal/participant-workspace-redirect.server';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string }>;
};

/**
 * Legacy agreement invite URLs redirect into the unified Participant Workspace.
 * The workspace determines whether to show agreement review or the commercial workspace.
 */
export default async function DealInviteRedirectPage({ params, searchParams }: PageProps) {
  const { token: raw } = await params;
  const { mode } = await searchParams;
  const inviteToken = decodeURIComponent(raw ?? '').trim();

  if (!inviteToken) {
    notFound();
  }

  const workspacePath = await resolveWorkspacePathFromInviteToken(inviteToken);
  if (!workspacePath) {
    notFound();
  }

  const query = mode === 'preview' ? '?mode=preview' : '';
  redirect(`${workspacePath}${query}`);
}
