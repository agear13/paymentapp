import { redirect, notFound } from 'next/navigation';
import { resolveWorkspacePathFromPaymentSetupToken } from '@/lib/participant-portal/participant-workspace-redirect.server';

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * Legacy payment-setup URLs redirect into the unified Participant Workspace payout step.
 */
export default async function PaymentSetupRedirectPage({ params }: PageProps) {
  const { token: raw } = await params;
  const paymentSetupToken = decodeURIComponent(raw ?? '').trim();

  if (!paymentSetupToken) {
    notFound();
  }

  const workspacePath = await resolveWorkspacePathFromPaymentSetupToken(paymentSetupToken);
  if (!workspacePath) {
    notFound();
  }

  redirect(workspacePath);
}
