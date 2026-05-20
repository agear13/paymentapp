'use client';

import * as React from 'react';
import Link from 'next/link';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReferralSharePanel } from '@/components/referrals/referral-share-panel';
import { ReferralWorkflowCallout } from '@/components/referrals/referral-workflow-callout';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';

type OperatorReferralRow = {
  id: string;
  referralLinkId: string;
  code: string;
  slug: string | null;
  vanityPath: string | null;
  referralUrl: string;
  qrUrl: string;
  status: string;
  linkStatus: string;
  participantUserId: string | null;
  participantLabel: string;
  createdAt: string;
  expiresAt: string | null;
};

export default function OperatorReferralsPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [rows, setRows] = React.useState<OperatorReferralRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organization-referrals?organizationId=${organizationId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (isOrgLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral sharing</h1>
          <p className="text-gray-600 mt-1">
            Operational hub for participant referral links, QR codes, and copy/share actions. Existing codes
            are shown as-is. Nothing is regenerated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings/services">
              <Settings className="h-4 w-4 mr-1" />
              Service catalog
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/partners/referral-links">Commission link setup</Link>
          </Button>
        </div>
      </div>

      <ReferralWorkflowCallout audience="operator" />

      <Card>
        <CardHeader>
          <CardTitle>Participant referral links</CardTitle>
          <CardDescription>
            Each row is an existing <code className="text-xs">referral_codes</code> record tied to your
            organization. Share these with participants after they join a project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading referral links…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-600 space-y-2">
              <p>No referral codes found for this organization yet.</p>
              <p>
                Create commission-enabled links under{' '}
                <Link href="/dashboard/partners/referral-links" className="text-blue-600 underline">
                  Partners → Commission link setup
                </Link>{' '}
                or complete participant onboarding. Codes are created automatically when links exist.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((r) => (
                <ReferralSharePanel
                  key={r.id}
                  code={r.code}
                  referralUrl={r.referralUrl}
                  qrUrl={r.qrUrl}
                  status={r.status}
                  vanityPath={r.vanityPath}
                  createdAt={r.createdAt}
                  participantLabel={r.participantLabel}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Also check</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/programs/participants" className="text-blue-600 underline">
            Program participants (Supabase)
          </Link>
          <Link href="/dashboard/referrals/mine" className="text-blue-600 underline">
            My referrals (participant view)
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
