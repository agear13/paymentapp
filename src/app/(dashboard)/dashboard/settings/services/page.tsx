'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Pencil, Archive, RotateCcw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatServiceActivityLine } from '@/lib/format/organization-service-timestamps';

type Row = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  linkedInvoiceCount: number;
};

type StatusTab = 'all' | 'active' | 'archived';

export default function OrganizationServicesPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const { currency: orgDefaultCurrency, isLoading: currencyLoading } = useOrganizationCurrency();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusTab, setStatusTab] = React.useState<StatusTab>('all');

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const createCurrencyInitialized = React.useRef(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editPrice, setEditPrice] = React.useState('');
  const [editCurrency, setEditCurrency] = React.useState('');
  const [editActive, setEditActive] = React.useState(true);
  const [editFieldErrors, setEditFieldErrors] = React.useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = React.useState(false);

  const [archiveTarget, setArchiveTarget] = React.useState<Row | null>(null);
  const [archiveLoading, setArchiveLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ organizationId });
      if (statusTab === 'active') qs.set('status', 'active');
      if (statusTab === 'archived') qs.set('status', 'archived');
      const res = await fetch(`/api/organization-services?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      const rawList = (json.data ?? []) as unknown[];
      setRows(
        rawList.map((raw) => {
          const o = raw as Record<string, unknown>;
          const created =
            typeof o.createdAt === 'string' && o.createdAt.trim() ? o.createdAt : null;
          const updated =
            typeof o.updatedAt === 'string' && o.updatedAt.trim() ? o.updatedAt : created;
          return {
            id: String(o.id ?? ''),
            name: String(o.name ?? ''),
            description: typeof o.description === 'string' ? o.description : '',
            price: typeof o.price === 'number' ? o.price : Number(o.price) || 0,
            currency: String(o.currency ?? ''),
            active: Boolean(o.active),
            createdAt: created,
            updatedAt: updated,
            linkedInvoiceCount:
              typeof o.linkedInvoiceCount === 'number'
                ? o.linkedInvoiceCount
                : Number(o.linkedInvoiceCount) || 0,
          };
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId, statusTab]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (currencyLoading || createCurrencyInitialized.current) return;
    setCurrency(orgDefaultCurrency);
    createCurrencyInitialized.current = true;
  }, [orgDefaultCurrency, currencyLoading]);

  const openEdit = (r: Row) => {
    setEditing(r);
    setEditName(r.name);
    setEditDescription(r.description);
    setEditPrice(String(r.price));
    setEditCurrency(r.currency);
    setEditActive(r.active);
    setEditFieldErrors({});
    setEditOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    const p = parseFloat(price);
    if (Number.isNaN(p) || p <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    const effectiveCurrency = (currency || orgDefaultCurrency).toUpperCase().slice(0, 3);
    setSaving(true);
    try {
      const res = await fetch('/api/organization-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name,
          description,
          price: p,
          currency: effectiveCurrency,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success('Service added');
      setName('');
      setDescription('');
      setPrice('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const p = parseFloat(editPrice);
    if (Number.isNaN(p) || p <= 0) {
      setEditFieldErrors({ price: 'Enter a valid price' });
      return;
    }
    setEditSaving(true);
    setEditFieldErrors({});
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        description: editDescription.trim(),
        price: p,
        currency: editCurrency.toUpperCase().slice(0, 3),
        active: editActive,
      };
      const res = await fetch(`/api/organization-services/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.details && Array.isArray(json.details)) {
          const next: Record<string, string> = {};
          for (const issue of json.details as Array<{ path: (string | number)[]; message: string }>) {
            const key = String(issue.path[0] ?? '');
            if (key) next[key] = issue.message;
          }
          setEditFieldErrors(next);
        }
        toast.error(json.error || 'Update failed');
        return;
      }
      toast.success('Service updated');
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/organization-services/${archiveTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Archive failed');
      toast.success('Service archived');
      setArchiveTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    } finally {
      setArchiveLoading(false);
    }
  };

  const restore = async (r: Row) => {
    try {
      const res = await fetch(`/api/organization-services/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Restore failed');
      toast.success('Service restored');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed');
    }
  };

  if (isOrgLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Service catalog</h1>
        <p className="text-gray-600 mt-1 max-w-2xl">
          Add the services your referral partners can offer customers. Changes only affect future
          checkouts. Past invoices are preserved automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add service</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitCreate} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Description</Label>
              <Input id="svc-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                This description appears on customer checkout pages.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="svc-price">Price</Label>
                <Input
                  id="svc-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 w-28">
                <Label htmlFor="svc-ccy">Currency</Label>
                <Input
                  id="svc-ccy"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add service'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Services</CardTitle>
            <CardDescription>
              Only active services appear on public referral pages. Archived services stay on historical
              invoices.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'archived'] as const).map((tab) => (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={statusTab === tab ? 'default' : 'outline'}
                onClick={() => setStatusTab(tab)}
              >
                {tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Archived'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading services…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-600">
              {statusTab === 'archived'
                ? 'No archived services.'
                : statusTab === 'active'
                  ? 'No active services. Add one above or restore an archived service.'
                  : 'No services yet. Add your first catalog entry above.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.name}</p>
                      <Badge variant={r.active ? 'default' : 'secondary'}>
                        {r.active ? 'Active' : 'Archived'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{r.description || '—'}</p>
                    {formatServiceActivityLine(r.createdAt, r.updatedAt) ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.linkedInvoiceCount} linked invoice{r.linkedInvoiceCount === 1 ? '' : 's'} ·{' '}
                        {formatServiceActivityLine(r.createdAt, r.updatedAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.linkedInvoiceCount} linked invoice{r.linkedInvoiceCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:ml-4">
                    <p className="font-semibold">
                      {r.price.toFixed(2)} {r.currency}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      {r.active ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setArchiveTarget(r)}>
                          <Archive className="h-3.5 w-3.5 mr-1" />
                          Archive
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => restore(r)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={editOpen} onOpenChange={(o) => !editSaving && setEditOpen(o)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit service</SheetTitle>
            <SheetDescription>Changes affect future referral checkouts only.</SheetDescription>
          </SheetHeader>
          {editing ? (
            <form onSubmit={submitEdit} className="mt-6 space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  aria-invalid={!!editFieldErrors.name}
                />
                {editFieldErrors.name ? (
                  <p className="text-sm text-red-600">{editFieldErrors.name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Input
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  aria-invalid={!!editFieldErrors.description}
                />
                {editFieldErrors.description ? (
                  <p className="text-sm text-red-600">{editFieldErrors.description}</p>
                ) : null}
              </div>
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="edit-price">Price</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                    aria-invalid={!!editFieldErrors.price}
                  />
                  {editFieldErrors.price ? (
                    <p className="text-sm text-red-600">{editFieldErrors.price}</p>
                  ) : null}
                </div>
                <div className="space-y-2 w-28">
                  <Label htmlFor="edit-ccy">Currency</Label>
                  <Input
                    id="edit-ccy"
                    maxLength={3}
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                    aria-invalid={!!editFieldErrors.currency}
                  />
                  {editFieldErrors.currency ? (
                    <p className="text-sm text-red-600">{editFieldErrors.currency}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="edit-active"
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <Label htmlFor="edit-active" className="font-normal cursor-pointer">
                  Active (visible on public referral pages)
                </Label>
              </div>
              <SheetFooter className="gap-2 sm:justify-start px-0">
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                  Cancel
                </Button>
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && !archiveLoading && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this service?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{archiveTarget?.name}</span> will be hidden from
                  public referral pages. Existing invoices and commission data are not changed.
                </p>
                {archiveTarget && archiveTarget.linkedInvoiceCount > 0 ? (
                  <p>
                    {archiveTarget.linkedInvoiceCount} historical invoice
                    {archiveTarget.linkedInvoiceCount === 1 ? '' : 's'} still reference this service.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={archiveLoading}>
              {archiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
