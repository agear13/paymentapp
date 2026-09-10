'use client';

import * as React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  handle?: string;
  notes?: string;
  isDefault: boolean;
  status: string;
  hederaAccountId?: string;
  details?: {
    address?: string;
    asset?: string;
    network?: string;
    memo?: string;
  } | null;
  createdAt: string;
}

export default function PayoutMethodsPage() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [methods, setMethods] = React.useState<PayoutMethod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createType, setCreateType] = React.useState<string>('PAYPAL');
  const [createHandle, setCreateHandle] = React.useState('');
  const [createNotes, setCreateNotes] = React.useState('');
  const [createHederaAccountId, setCreateHederaAccountId] = React.useState('');
  const [createCrypto, setCreateCrypto] = React.useState<CryptoPayoutDestinationForm>(
    EMPTY_CRYPTO_PAYOUT_DESTINATION
  );
  const [createDefault, setCreateDefault] = React.useState(true);
  const [createLoading, setCreateLoading] = React.useState(false);
  const supabase = createClient();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  const fetchMethods = React.useCallback(async () => {
    if (!organizationId || !userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/payout-methods?organizationId=${organizationId}&userId=${userId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setMethods(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  React.useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleCreate = async () => {
    if (!organizationId || !userId) return;
    setCreateLoading(true);
    try {
      const res = await fetch('/api/payout-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          userId,
          methodType: createType,
          handle:
            createType === 'CRYPTO'
              ? createCrypto.address.trim() || undefined
              : createHandle.trim() || undefined,
          notes: createNotes.trim() || undefined,
          hederaAccountId:
            createType === 'HEDERA' ? createHederaAccountId.trim() || undefined : undefined,
          details:
            createType === 'CRYPTO' ? cryptoDestinationDetailsPayload(createCrypto) : undefined,
          isDefault: createDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      toast.success('Payout method added');
      setCreateOpen(false);
      setCreateHandle('');
      setCreateNotes('');
      setCreateHederaAccountId('');
      setCreateCrypto(EMPTY_CRYPTO_PAYOUT_DESTINATION);
      fetchMethods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreateLoading(false);
    }
  };

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Payout methods</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Payout methods</h1>
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Payout methods</h1>
          <p className="text-muted-foreground">
            Add where you want to be paid. Provvy determines which payout rail can service each
            destination. No raw bank numbers or provider credentials.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchMethods} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={!userId}>
            <Plus className="h-4 w-4 mr-2" />
            Add method
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your payout destinations</CardTitle>
          <CardDescription>
            Used when creating payout batches. Provvy selects the rail from the destination — you do
            not choose Cregis, Hedera, or another provider here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : methods.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No payout methods yet. Add one to receive commission payouts.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Default</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant="outline">{payoutDestinationTypeLabel(m.methodType)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {m.methodType === 'HEDERA' ? m.hederaAccountId || m.handle || '—' : m.handle || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.methodType === 'CRYPTO' && (m.details?.asset || m.details?.network)
                        ? [m.details.asset, m.details.network].filter(Boolean).join(' · ')
                        : '—'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{m.notes || '—'}</TableCell>
                    <TableCell>{m.isDefault ? 'Yes' : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payout method</DialogTitle>
            <DialogDescription>
              Store a destination handle. Provvy will determine which payout rail can service it.
              No raw bank account numbers or provider wallet IDs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select
                value={createType}
                onValueChange={(value) => {
                  setCreateType(value);
                  setCreateCrypto(EMPTY_CRYPTO_PAYOUT_DESTINATION);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createType === 'HEDERA' ? (
              <div>
                <Label>Hedera Account ID (canonical destination for HTS payouts)</Label>
                <Input
                  value={createHederaAccountId}
                  onChange={(e) => setCreateHederaAccountId(e.target.value)}
                  placeholder="0.0.12345"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: 0.0.x, used for USDC/USDT/HBAR payouts via HashPack
                </p>
              </div>
            ) : createType === 'CRYPTO' ? (
              <CryptoPayoutDestinationFields
                value={createCrypto}
                onChange={setCreateCrypto}
                showErrors
              />
            ) : (
              <div>
                <Label>Handle (e.g. PayPal email, Wise email)</Label>
                <Input
                  value={createHandle}
                  onChange={(e) => setCreateHandle(e.target.value)}
                  placeholder="participant@example.com"
                />
              </div>
            )}
            <div>
              <Label>Notes (e.g. bank transfer instructions)</Label>
              <Textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={createDefault}
                onChange={(e) => setCreateDefault(e.target.checked)}
              />
              <Label htmlFor="isDefault">Set as default</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createLoading ||
                (createType === 'CRYPTO' && cryptoDestinationFormErrors(createCrypto).length > 0)
              }
            >
              {createLoading ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
