import { notFound } from 'next/navigation';

import { ObligationReportClient } from '@/components/agreement-analyzer/obligation-report-client';
import { isValidReportAccessToken } from '@/lib/agreement-analyzer/report-types';

export const metadata = {
  title: 'AI Obligation Report | Provvypay',
  description: 'View your AI-generated commercial agreement obligation report.',
};

export default async function AgreementObligationReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidReportAccessToken(token)) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <ObligationReportClient token={token} />
    </main>
  );
}
