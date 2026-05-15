'use client';

import * as React from 'react';
import Link from 'next/link';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReferralSharePanel } from '@/components/referrals/referral-share-panel';
import { ReferralWorkflowCallout } from '@/components/referrals/referral-workflow-callout';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type DashboardPayload = {
  referralCodes: Array<{
    id: string;
    code: string;
    slug: string | null;
    vanityPath: string | null;
    referralUrl: string;
    qrUrl: string;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    shortCode: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    serviceId: string | null;
  }>;
  commissionItems: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    shortCode: string | null;
    invoiceReference: string | null;
  }>;
};

export default function MyReferralsPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/referral-dashboard?organizationId=${organizationId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (isOrgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!data) {
    return <p className="text-gray-600">Nothing to show.</p>;
  }

  const paid = data.commissionItems.filter((c) => c.status === 'PAID');
  const pending = data.commissionItems.filter((c) => c.status !== 'PAID');

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">My referrals</h1>
        <p className="text-gray-600 mt-1">
          Your shareable links, attributed invoices, and commission lines. Copy your link or QR and send it
          to customers — attribution is automatic when they pay.
        </p>
      </div>

      <ReferralWorkflowCallout audience="participant" />

      <Card>
        <CardHeader>
          <CardTitle>Your referral links</CardTitle>
          <CardDescription>
            These links already exist for your account. Share them as-is — we do not generate new codes
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.referralCodes.length === 0 ? (
            <div className="text-sm text-gray-600 space-y-2">
              <p>No referral link is assigned to your user yet.</p>
              <p>
                Ask your operator to add you as a participant, or visit{' '}
                <Link href="/dashboard/referrals" className="text-blue-600 underline">
                  Referral sharing
                </Link>{' '}
                if you manage the organization.
              </p>
            </div>
          ) : (
            data.referralCodes.map((c) => (
              <ReferralSharePanel
                key={c.id}
                code={c.code}
                referralUrl={c.referralUrl}
                qrUrl={c.qrUrl}
                status="ACTIVE"
                vanityPath={c.vanityPath}
                createdAt={c.createdAt}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices from your referrals</CardTitle>
          <CardDescription>Payment links created after someone used your referral URL.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-gray-600">No attributed invoices yet — share your link to get started.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.invoices.map((i) => (
                <li key={i.id} className="py-3 flex justify-between gap-4">
                  <div>
                    <p className="font-medium">{i.description}</p>
                    <p className="text-xs text-gray-500 font-mono">{i.shortCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {i.amount.toFixed(2)} {i.currency}
                    </p>
                    <Badge variant="secondary">{i.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commissions</CardTitle>
          <CardDescription>Ledger obligation lines tied to your attributed invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Paid</p>
            {paid.length === 0 ? (
              <p className="text-sm text-gray-500">None yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {paid.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {p.shortCode} {p.invoiceReference ? `· ${p.invoiceReference}` : ''}
                    </span>
                    <span className="font-mono">
                      {p.amount.toFixed(4)} {p.currency}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Pending</p>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">None.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {pending.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {p.shortCode} {p.invoiceReference ? `· ${p.invoiceReference}` : ''}
                    </span>
                    <span className="font-mono">
                      {p.amount.toFixed(4)} {p.currency} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
