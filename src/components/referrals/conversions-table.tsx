'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, XCircle, RotateCcw, DollarSign, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Participant {
  id: string;
  name: string;
  role: string;
  referral_code: string;
  program_id: string;
}

interface Conversion {
  id: string;
  program_id: string;
  conversion_type: string;
  gross_amount: number | null;
  currency: string;
  status: string;
  proof_json: any;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  referral_programs: { name: string; slug: string };
  referral_participants: { name: string; role: string; referral_code: string };
}

interface ConversionsTableProps {
  conversions: Conversion[];
  isAdmin?: boolean;
  participantsByProgram?: Record<string, Participant[]>;
}

export function ConversionsTable({ conversions, isAdmin, participantsByProgram = {} }: ConversionsTableProps) {
  const router = useRouter();
  const [selectedConversion, setSelectedConversion] = useState<Conversion | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'markPaid' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const [markPaidConversion, setMarkPaidConversion] = useState<Conversion | null>(null);
  const [markPaidGross, setMarkPaidGross] = useState('');
  const [markPaidCurrency, setMarkPaidCurrency] = useState('USD');
  const [markPaidAllocations, setMarkPaidAllocations] = useState<
    Array<{ referral_participant_id: string; amount: string }>
  >([{ referral_participant_id: '', amount: '' }]);

  const canMarkPaid = (c: Conversion) =>
    isAdmin &&
    ((c.status === 'approved' && c.conversion_type === 'lead_submitted') ||
      (c.status === 'pending' && c.conversion_type === 'booking_confirmed'));

  const openMarkPaidModal = (conversion: Conversion) => {
    setMarkPaidConversion(conversion);
    setMarkPaidGross('');
    setMarkPaidCurrency('USD');
    const participants = participantsByProgram[conversion.program_id] || [];
    setMarkPaidAllocations([
      {
        referral_participant_id: participants[0]?.id ?? '',
        amount: '',
      },
    ]);
  };

  const closeMarkPaidModal = () => {
    setMarkPaidConversion(null);
    setMarkPaidGross('');
    setMarkPaidCurrency('USD');
    setMarkPaidAllocations([{ referral_participant_id: '', amount: '' }]);
  };

  const addAllocationRow = () => {
    setMarkPaidAllocations((prev) => [...prev, { referral_participant_id: '', amount: '' }]);
  };

  const removeAllocationRow = (index: number) => {
    setMarkPaidAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, field: 'referral_participant_id' | 'amount', value: string) => {
    setMarkPaidAllocations((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleMarkPaidSubmit = async () => {
    if (!markPaidConversion) return;

    const gross = parseFloat(markPaidGross);
    if (isNaN(gross) || gross <= 0) {
      toast.error('Enter a valid gross amount');
      return;
    }

    const allocations = markPaidAllocations
      .filter((a) => a.referral_participant_id && a.amount)
      .map((a) => ({
        referral_participant_id: a.referral_participant_id,
        amount: parseFloat(a.amount),
      }))
      .filter((a) => !isNaN(a.amount) && a.amount > 0);

    if (allocations.length === 0) {
      toast.error('Add at least one allocation with participant and amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/referrals/conversions/${markPaidConversion.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gross_amount: gross,
          currency: markPaidCurrency,
          allocations,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to mark paid');
        return;
      }

      toast.success('Marked as paid', {
        description: `Created ${data.created} ledger entries${data.skipped ? `, ${data.skipped} already existed` : ''}`,
      });
      closeMarkPaidModal();
      router.refresh();
    } catch (err) {
      toast.error('Failed to mark paid', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReplayLedger = async (conversionId: string) => {
    setReplayingId(conversionId);
    try {
      const response = await fetch(`/api/referrals/conversions/${conversionId}/replay-ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to replay ledger', {
          description: data.details,
        });
        return;
      }

      if (data.created > 0) {
        toast.success(`Created ${data.created} ledger entries`, {
          description: data.skipped ? `${data.skipped} already existed` : undefined,
        });
      } else {
        toast.success('Ledger entries already exist', {
          description: data.skipped ? `${data.skipped} skipped (idempotent)` : 'No duplicate created',
        });
      }
      router.refresh();
    } catch (err) {
      toast.error('Failed to replay ledger', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setReplayingId(null);
    }
  };

  const handleAction = async () => {
    if (!selectedConversion || !actionType) return;

    setLoading(true);
    try {
      const endpoint = `/api/referrals/conversions/${selectedConversion.id}/${actionType}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: actionType === 'reject' ? JSON.stringify({ reason: rejectReason }) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to ${actionType} conversion`);
      }

      // Close dialog and refresh
      setSelectedConversion(null);
      setActionType(null);
      setRejectReason('');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (conversion: Conversion, type: 'approve' | 'reject') => {
    setSelectedConversion(conversion);
    setActionType(type);
  };

  const closeDialog = () => {
    setSelectedConversion(null);
    setActionType(null);
    setRejectReason('');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversions.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500">
                No conversions found
              </TableCell>
            </TableRow>
          )}
          {conversions.map((conversion) => (
            <TableRow key={conversion.id}>
              <TableCell>
                {new Date(conversion.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>{conversion.referral_programs.name}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{conversion.referral_participants.name}</div>
                  <div className="text-sm text-gray-500">
                    {conversion.referral_participants.role} • {conversion.referral_participants.referral_code}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{conversion.conversion_type}</Badge>
              </TableCell>
              <TableCell>
                {conversion.gross_amount 
                  ? `${conversion.currency} ${conversion.gross_amount}`
                  : '—'}
              </TableCell>
              <TableCell>{getStatusBadge(conversion.status)}</TableCell>
              <TableCell>
                <div className="flex gap-2 items-center flex-wrap">
                  {conversion.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(conversion, 'approve')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(conversion, 'reject')}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {canMarkPaid(conversion) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openMarkPaidModal(conversion)}
                      title="Mark as payment completed and create ledger entries"
                    >
                      <DollarSign className="h-4 w-4" />
                      <span className="ml-1">Mark Paid</span>
                    </Button>
                  )}
                  {isAdmin && conversion.status === 'approved' && conversion.conversion_type === 'payment_completed' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReplayLedger(conversion.id)}
                      disabled={replayingId === conversion.id}
                      title="Replay Ledger: create partner ledger entry if missing"
                    >
                      {replayingId === conversion.id ? (
                        '...'
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4" />
                          <span className="ml-1">Replay Ledger</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={selectedConversion !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Conversion
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'This will create a ledger entry for the participant\'s earnings.'
                : 'This conversion will be marked as rejected.'}
            </DialogDescription>
          </DialogHeader>

          {selectedConversion && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Participant</p>
                <p className="text-sm text-gray-600">{selectedConversion.referral_participants.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Conversion Type</p>
                <p className="text-sm text-gray-600">{selectedConversion.conversion_type}</p>
              </div>
              {selectedConversion.gross_amount && (
                <div>
                  <p className="text-sm font-medium">Amount</p>
                  <p className="text-sm text-gray-600">
                    {selectedConversion.currency} {selectedConversion.gross_amount}
                  </p>
                </div>
              )}
              {selectedConversion.proof_json && (
                <div>
                  <p className="text-sm font-medium">Proof</p>
                  <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(selectedConversion.proof_json, null, 2)}
                  </pre>
                </div>
              )}

              {actionType === 'reject' && (
                <div>
                  <Label htmlFor="reason">Rejection Reason</Label>
                  <Textarea
                    id="reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Why are you rejecting this conversion?"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={loading}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
            >
              {loading ? 'Processing...' : actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={markPaidConversion !== null} onOpenChange={(open) => !open && closeMarkPaidModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record payment completion and create ledger entries for each beneficiary. This will
              update the conversion to payment_completed and write one ledger row per allocation.
            </DialogDescription>
          </DialogHeader>

          {markPaidConversion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gross">Gross Amount</Label>
                  <Input
                    id="gross"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="100.00"
                    value={markPaidGross}
                    onChange={(e) => setMarkPaidGross(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={markPaidCurrency} onValueChange={setMarkPaidCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Allocations</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addAllocationRow}>
                    <Plus className="h-4 w-4" />
                    <span className="ml-1">Add</span>
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {markPaidAllocations.map((row, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select
                        value={row.referral_participant_id}
                        onValueChange={(v) => updateAllocation(index, 'referral_participant_id', v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select participant" />
                        </SelectTrigger>
                        <SelectContent>
                          {(participantsByProgram[markPaidConversion.program_id] || []).map(
                            (p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.role}) • {p.referral_code}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Amount"
                        className="w-24"
                        value={row.amount}
                        onChange={(e) => updateAllocation(index, 'amount', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAllocationRow(index)}
                        disabled={markPaidAllocations.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeMarkPaidModal} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaidSubmit} disabled={loading}>
              {loading ? 'Processing...' : 'Mark Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
