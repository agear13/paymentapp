'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
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
import { toast } from 'sonner';

interface CommissionObligation {
  id: string;
  paymentLinkId: string;
  referralCode: string;
  consultantAmount: number;
  bdPartnerAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  shortCode?: string;
}

export default function CommissionsPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [obligations, setObligations] = React.useState<CommissionObligation[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchObligations = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/commissions/obligations?organizationId=${organizationId}&status=POSTED`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setObligations(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    fetchObligations();
  }, [fetchObligations]);

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Commissions</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Commissions</h1>
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Commissions</h1>
          <p className="text-muted-foreground">
            Posted commission obligations from referral payments.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchObligations} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posted obligations</CardTitle>
          <CardDescription>
            Ledger entries (DR 6105, CR 2110, 2120) created when customers pay via referral links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : obligations.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No posted commissions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Referral code</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Partner 1</TableHead>
                  <TableHead className="text-right">Partner 2</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      {new Date(o.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono">{o.referralCode}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.shortCode ? `#${o.shortCode}` : o.paymentLinkId?.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {o.currency} {o.consultantAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {o.currency} {o.bdPartnerAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
