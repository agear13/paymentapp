'use client';

import * as React from 'react';
import { Archive, Loader2, Pencil, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { formatServiceActivityLine } from '@/lib/format/organization-service-timestamps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type ServiceRow = {
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

function parseRows(rawList: unknown[]): ServiceRow[] {
  return rawList.map((raw) => {
    const o = raw as Record<string, unknown>;
    const created = typeof o.createdAt === 'string' && o.createdAt.trim() ? o.createdAt : null;
    const updated = typeof o.updatedAt === 'string' && o.updatedAt.trim() ? o.updatedAt : created;
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
  });
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

export function ReferralManagementServicesPanel({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { currency: orgDefaultCurrency, isLoading: currencyLoading } = useOrganizationCurrency();
  const [rows, setRows] = React.useState<ServiceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusTab, setStatusTab] = React.useState<StatusTab>('all');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const [editing, setEditing] = React.useState<ServiceRow | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editPrice, setEditPrice] = React.useState('');
  const [editCurrency, setEditCurrency] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<ServiceRow | null>(null);
  const [archiveLoading, setArchiveLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ organizationId });
      if (statusTab === 'active') qs.set('status', 'active');
      if (statusTab === 'archived') qs.set('status', 'archived');
      const res = await csrfAwareFetch(`/api/organization-services?${qs.toString()}`, {
        credentials: 'include',
      });
      const json = (await res.json()) as { data?: unknown[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load services');
      setRows(parseRows(json.data ?? []));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [organizationId, statusTab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (currencyLoading) return;
    setCurrency(orgDefaultCurrency);
  }, [orgDefaultCurrency, currencyLoading]);

  const notifyChanged = () => {
    onChanged?.();
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationId) return;
    const parsedPrice = parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    setSaving(true);
    try {
      const res = await csrfAwareFetch('/api/organization-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationId,
          name: name.trim(),
          description: description.trim(),
          price: parsedPrice,
          currency: (currency || orgDefaultCurrency).toUpperCase().slice(0, 3),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not create service');
      toast.success('Service added');
      setName('');
      setDescription('');
      setPrice('');
      await load();
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create service');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ServiceRow) => {
    setEditing(row);
    setEditName(row.name);
    setEditDescription(row.description);
    setEditPrice(String(row.price));
    setEditCurrency(row.currency);
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const parsedPrice = parseFloat(editPrice);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    setEditSaving(true);
    try {
      const res = await csrfAwareFetch(`/api/organization-services/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          price: parsedPrice,
          currency: editCurrency.toUpperCase().slice(0, 3),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not update service');
      toast.success('Service updated. Future checkouts use the new details; past invoices stay as they were.');
      setEditing(null);
      await load();
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update service');
    } finally {
      setEditSaving(false);
    }
  };

  const setActive = async (row: ServiceRow, active: boolean) => {
    const res = await csrfAwareFetch(`/api/organization-services/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error || (active ? 'Restore failed' : 'Archive failed'));
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await setActive(archiveTarget, false);
      toast.success('Service archived. It will not appear on new referral pages.');
      setArchiveTarget(null);
      await load();
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Archive failed');
    } finally {
      setArchiveLoading(false);
    }
  };

  const restore = async (row: ServiceRow) => {
    try {
      await setActive(row, true);
      toast.success('Service restored');
      await load();
      notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Restore failed');
    }
  };

  if (orgLoading) {
    return <p className="py-12 text-center text-[13px] text-ink-soft">Loading services…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-[14px] text-ink-soft">
        Create the products or services promoters can sell. Archived services stay off new public
        referral pages. Historical invoices and commissions are not changed.
      </p>

      <form className="space-y-3 rounded-2xl border border-border bg-card p-4" onSubmit={submitCreate}>
        <p className="text-[13px] font-semibold">Add service</p>
        <div className="space-y-1">
          <Label htmlFor="rm-service-name">Service name</Label>
          <Input id="rm-service-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rm-service-description">Description</Label>
          <Input
            id="rm-service-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="rm-service-price">Price</Label>
            <Input
              id="rm-service-price"
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </div>
          <div className="w-28 space-y-1">
            <Label htmlFor="rm-service-currency">Currency</Label>
            <Input
              id="rm-service-currency"
              maxLength={3}
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={saving || !organizationId}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save service
        </Button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Services</h2>
          <div className="flex gap-2">
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
        </div>
        {loading ? (
          <p className="text-[13px] text-ink-soft">Loading services…</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-ink-soft">
            {statusTab === 'archived'
              ? 'No archived services.'
              : 'No services yet. Add the offerings promoters can sell.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-soft">
                      {row.active ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-soft">{row.description || 'No description'}</p>
                  <p className="mt-1 text-[13px] font-medium">
                    {formatPrice(row.price, row.currency)}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {row.linkedInvoiceCount} linked invoice{row.linkedInvoiceCount === 1 ? '' : 's'}
                    {formatServiceActivityLine(row.createdAt, row.updatedAt)
                      ? ` · ${formatServiceActivityLine(row.createdAt, row.updatedAt)}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {row.active ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setArchiveTarget(row)}>
                      <Archive className="mr-1 h-3.5 w-3.5" />
                      Archive
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => void restore(row)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Restore
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <form className="space-y-3 rounded-2xl border border-border bg-card p-4" onSubmit={submitEdit}>
          <p className="text-[13px] font-semibold">Edit service</p>
          <p className="text-[13px] text-ink-soft">
            Changes affect future referral checkouts only. Past invoices stay as they were.
          </p>
          <Input value={editName} onChange={(event) => setEditName(event.target.value)} required />
          <Input
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            placeholder="Description"
          />
          <div className="flex gap-3">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={editPrice}
              onChange={(event) => setEditPrice(event.target.value)}
              required
            />
            <Input
              className="w-28"
              maxLength={3}
              value={editCurrency}
              onChange={(event) => setEditCurrency(event.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={editSaving}>
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && !archiveLoading && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this service?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{archiveTarget?.name}</span> will be hidden
                  from public referral pages. Existing invoices and commission data are not changed.
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
            <AlertDialogAction onClick={() => void confirmArchive()} disabled={archiveLoading}>
              {archiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
