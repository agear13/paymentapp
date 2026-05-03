'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

type RecurringTemplateRow = {
  id: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string | null;
  interval: 'weekly' | 'monthly' | 'custom';
  intervalCount: number;
  nextRunAt: string;
  endDate: string | null;
  status: 'active' | 'paused';
  dueDaysAfterInvoice: number | null;
  lastRunAt: string | null;
};

export default function RecurringTemplatesPage() {
  const { toast } = useToast();
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [templates, setTemplates] = React.useState<RecurringTemplateRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [amount, setAmount] = React.useState('100');
  const [currency, setCurrency] = React.useState('AUD');
  const [description, setDescription] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [interval, setInterval] = React.useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [intervalCount, setIntervalCount] = React.useState('1');
  const defaultNextRunLocal = React.useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [nextRunAt, setNextRunAt] = React.useState(defaultNextRunLocal);
  const [endDate, setEndDate] = React.useState('');
  const [dueDays, setDueDays] = React.useState('');

  const load = React.useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/recurring-templates?organizationId=${encodeURIComponent(organizationId)}`
      );
      if (!res.ok) throw new Error('Failed to load templates');
      const json = (await res.json()) as { data: RecurringTemplateRow[] };
      setTemplates(json.data ?? []);
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        organizationId,
        amount: Number(amount),
        currency: currency.trim().toUpperCase(),
        description: description.trim(),
        interval,
        intervalCount: Number(intervalCount) || 1,
        nextRunAt: new Date(nextRunAt).toISOString(),
      };
      if (customerEmail.trim()) payload.customerEmail = customerEmail.trim();
      if (endDate.trim()) payload.endDate = endDate.trim();
      if (dueDays.trim() !== '') {
        const n = Number(dueDays);
        if (!Number.isNaN(n)) payload.dueDaysAfterInvoice = n;
      }

      const res = await fetch('/api/recurring-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      toast({ title: 'Saved', description: 'Recurring template created.' });
      setDescription('');
      setCustomerEmail('');
      await load();
    } catch (err: unknown) {
      toast({
        title: 'Could not create',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePause(row: RecurringTemplateRow) {
    const next = row.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/recurring-templates/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast({
        title: next === 'paused' ? 'Paused' : 'Active',
        description: 'Template updated.',
      });
      await load();
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Update failed',
        variant: 'destructive',
      });
    }
  }

  if (isOrgLoading || !organizationId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading organization…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recurring invoices</h1>
        <p className="text-sm text-muted-foreground">
          Automatically create a new invoice link on a schedule. Each run issues a fresh payment
          link and uses your normal invoice numbering and Xero sync.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New template</CardTitle>
          <CardDescription>
            Generated invoices are invoice-only links (same as manual invoice-only mode). The
            scheduler runs about every five minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid max-w-lg gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Invoice currency (ISO)</Label>
              <Input
                id="currency"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerEmail">Customer email (optional)</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label>Interval</Label>
                <Select value={interval} onValueChange={(v) => setInterval(v as typeof interval)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom (days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="intervalCount">Every N periods</Label>
                <Input
                  id="intervalCount"
                  type="number"
                  min={1}
                  max={366}
                  value={intervalCount}
                  onChange={(e) => setIntervalCount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nextRunAt">First run (local)</Label>
              <Input
                id="nextRunAt"
                type="datetime-local"
                value={nextRunAt}
                onChange={(e) => setNextRunAt(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="endDate">End date (optional, YYYY-MM-DD)</Label>
                <Input
                  id="endDate"
                  placeholder="2027-12-31"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDays">Due in days after invoice (optional)</Label>
                <Input
                  id="dueDays"
                  type="number"
                  min={0}
                  placeholder="30"
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create template'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Active templates run automatically; paused templates are skipped.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                    <TableCell>
                      {t.amount} {t.currency}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.interval === 'weekly' &&
                        `Every ${t.intervalCount} week${t.intervalCount > 1 ? 's' : ''}`}
                      {t.interval === 'monthly' &&
                        `Every ${t.intervalCount} month${t.intervalCount > 1 ? 's' : ''}`}
                      {t.interval === 'custom' &&
                        `Every ${t.intervalCount} day${t.intervalCount > 1 ? 's' : ''}`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(t.nextRunAt), 'PPp')}
                    </TableCell>
                    <TableCell className="capitalize">{t.status}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => togglePause(t)}>
                        {t.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
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
