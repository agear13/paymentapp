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

const METHOD_TYPES = ['PAYPAL', 'WISE', 'BANK_TRANSFER', 'CRYPTO', 'MANUAL_NOTE'] as const;

interface PayoutMethod {
  id: string;
  methodType: string;
  handle: string | null;
  notes: string | null;
  isDefault: boolean;
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
          handle: form.handle.trim() || null,
          notes: form.notes.trim() || null,
          isDefault: form.isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      toast.success('Payout destination added');
      setDialogOpen(false);
      setForm({ methodType: 'PAYPAL', handle: '', notes: '', isDefault: true });
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
              Set your default payout method so commissions can be paid to you.
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
                    {m.methodType}
                  </Badge>
                  {m.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-muted-foreground">
                  {m.handle || m.notes || '—'}
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
              PayPal email, Wise email, or other handle. No raw bank account numbers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="methodType">Method type</Label>
              <Select
                value={form.methodType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, methodType: v as (typeof METHOD_TYPES)[number] }))
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
            <div className="space-y-2">
              <Label htmlFor="handle">Handle (email, etc.)</Label>
              <Input
                id="handle"
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                placeholder="e.g. payee@example.com"
              />
            </div>
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
              <Button type="submit" disabled={creating}>
                {creating ? 'Adding...' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
