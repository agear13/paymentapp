'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Wallet, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  CryptoPayoutDestinationFields,
  EMPTY_CRYPTO_PAYOUT_DESTINATION,
  cryptoDestinationDetailsPayload,
  cryptoDestinationFormErrors,
  type CryptoPayoutDestinationForm,
} from '@/components/payouts/crypto-payout-destination-fields';
import { payoutDestinationTypeLabel } from '@/lib/payouts/payout-rail-presentation';

const METHOD_TYPES = ['PAYPAL', 'WISE', 'BANK_TRANSFER', 'CRYPTO', 'MANUAL_NOTE', 'HEDERA'] as const;

interface PayoutMethod {
  id: string;
  methodType: string;
  handle: string | null;
  notes: string | null;
  isDefault: boolean;
  hederaAccountId?: string | null;
  details?: {
    address?: string;
    asset?: string;
    network?: string;
    memo?: string;
  } | null;
  createdAt: string;
}

/**
 * Minimal "Payout destination" section for consultant dashboard.
 * Allows user to set default payout method (type + handle + notes).
 */
export function PayoutDestinationCard() {
  const { organizationId, isLoading } = useOrganization();
  const [methods, setMethods] = React.useState<PayoutMethod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    methodType: 'PAYPAL' as (typeof METHOD_TYPES)[number],
    handle: '',
    notes: '',
    hederaAccountId: '',
    crypto: EMPTY_CRYPTO_PAYOUT_DESTINATION as CryptoPayoutDestinationForm,
    isDefault: true,
  });

  const fetchMethods = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payout-methods?organizationId=${organizationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setMethods(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/payout-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          methodType: form.methodType,
          handle:
            form.methodType === 'CRYPTO'
              ? form.crypto.address.trim() || null
              : form.handle.trim() || null,
          notes: form.notes.trim() || null,
          hederaAccountId:
            form.methodType === 'HEDERA' ? form.hederaAccountId.trim() || null : null,
          details:
            form.methodType === 'CRYPTO' ? cryptoDestinationDetailsPayload(form.crypto) : undefined,
          isDefault: form.isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      toast.success('Payout destination added');
      setDialogOpen(false);
      setForm({
        methodType: 'PAYPAL',
        handle: '',
        notes: '',
        hederaAccountId: '',
        crypto: EMPTY_CRYPTO_PAYOUT_DESTINATION,
        isDefault: true,
      });
      fetchMethods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading || !organizationId) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payout destination
            </CardTitle>
            <CardDescription>
              Set your default destination. Provvy determines which payout rail can service it.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchMethods} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payout method set. Add one so we know where to send your commissions.
          </p>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <Badge variant="outline" className="mr-2">
                    {payoutDestinationTypeLabel(m.methodType)}
                  </Badge>
                  {m.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-muted-foreground">
                  {m.methodType === 'HEDERA'
                    ? m.hederaAccountId || m.notes || '—'
                    : m.methodType === 'CRYPTO'
                      ? [m.handle || m.details?.address, m.details?.asset, m.details?.network]
                          .filter(Boolean)
                          .join(' · ') || '—'
                      : m.handle || m.notes || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payout destination</DialogTitle>
            <DialogDescription>
              PayPal email, Wise email, crypto wallet, or other handle. Provvy chooses the rail.
              No raw bank numbers or provider wallet IDs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="methodType">Method type</Label>
              <Select
                value={form.methodType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    methodType: v as (typeof METHOD_TYPES)[number],
                    crypto: EMPTY_CRYPTO_PAYOUT_DESTINATION,
                  }))
                }
              >
                <SelectTrigger id="methodType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.methodType === 'HEDERA' ? (
              <div className="space-y-2">
                <Label htmlFor="hederaAccountId">Hedera Account ID</Label>
                <Input
                  id="hederaAccountId"
                  value={form.hederaAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, hederaAccountId: e.target.value }))}
                  placeholder="0.0.12345"
                />
                <p className="text-xs text-muted-foreground">Format 0.0.x for USDC/USDT payouts</p>
              </div>
            ) : form.methodType === 'CRYPTO' ? (
              <CryptoPayoutDestinationFields
                value={form.crypto}
                onChange={(crypto) => setForm((f) => ({ ...f, crypto }))}
                showErrors
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="handle">Handle (email, etc.)</Label>
                <Input
                  id="handle"
                  value={form.handle}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                  placeholder="e.g. payee@example.com"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Bank instructions, etc."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="isDefault">Set as default</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  creating ||
                  (form.methodType === 'CRYPTO' &&
                    cryptoDestinationFormErrors(form.crypto).length > 0)
                }
              >
                {creating ? 'Adding...' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
