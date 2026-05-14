'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Row = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  active: boolean;
};

export default function OrganizationServicesPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [currency, setCurrency] = React.useState('AUD');

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organization-services?organizationId=${organizationId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    const p = parseFloat(price);
    if (Number.isNaN(p) || p <= 0) {
      toast.error('Enter a valid price');
      return;
    }
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
          currency: currency.toUpperCase().slice(0, 3),
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

  if (isOrgLoading || loading) {
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
        <p className="text-gray-600 mt-1">
          Minimal priced services shown on referral landing pages when the merchant has catalog entries.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add service</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Description</Label>
              <Input id="svc-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Active services appear on public referral pages when catalog entries exist.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-600">No services yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.id} className="py-3 flex justify-between gap-4">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{r.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">
                      {r.price.toFixed(2)} {r.currency}
                    </p>
                    <p className="text-xs text-gray-500">{r.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
