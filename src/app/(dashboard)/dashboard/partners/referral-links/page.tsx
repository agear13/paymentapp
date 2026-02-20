'use client';

import * as React from 'react';
import { Plus, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreateReferralLinkModal } from '@/components/referrals/create-referral-link-modal';
import { toast } from 'sonner';

interface ReferralLinkRow {
  id: string;
  code: string;
  status: string;
  url: string;
  consultantPct: number;
  bdPartnerPct: number;
  basis: string;
  createdAt: string;
}

export default function ReferralLinksPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [links, setLinks] = React.useState<ReferralLinkRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const fetchLinks = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/referral-links?organizationId=${organizationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setLinks(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load links');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const copyLink = async (url: string, code: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      toast.success('Link copied');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Referral Links</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Referral Links</h1>
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Referral Links</h1>
          <p className="text-muted-foreground">
            Programmable payments engine: create commission-enabled links. Revenue splits execute automatically per your rules.
          </p>
          <p className="text-xs text-muted-foreground mt-2 rounded-md bg-muted/60 p-2 max-w-xl">
            Add partners without KYC. Generate a unique link and start tracking attribution immediately—no Stripe Connect–style onboarding required.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchLinks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Link
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your links</CardTitle>
          <CardDescription>
            Share these URLs. Each payment executes your rules and posts commissions to the ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : links.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No referral links yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead>Partner 1 %</TableHead>
                  <TableHead>Partner 2 %</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-mono">{link.code}</TableCell>
                    <TableCell>
                      <Badge variant={link.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {link.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{link.basis}</TableCell>
                    <TableCell>{(link.consultantPct * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(link.bdPartnerPct * 100).toFixed(1)}%</TableCell>
                    <TableCell>
                      {new Date(link.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(link.url, link.code)}
                          title="Copy link"
                        >
                          {copiedCode === link.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Test link"
                        >
                          <a href={`/r/${link.code}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateReferralLinkModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId}
        userType="BD_PARTNER"
        defaultUseSplits
        onSuccess={fetchLinks}
      />
    </div>
  );
}
