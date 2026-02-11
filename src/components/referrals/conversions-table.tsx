'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Conversion {
  id: string;
  conversion_type: string;
  gross_amount: number | null;
  currency: string;
  status: string;
  proof_json: any;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  referral_programs: { name: string };
  referral_participants: { name: string; role: string; referral_code: string };
}

export function ConversionsTable({ conversions, isAdmin }: { conversions: Conversion[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [selectedConversion, setSelectedConversion] = useState<Conversion | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

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

      if (data.created) {
        toast.success('Ledger entry created');
      } else {
        toast.success('Ledger entry already exists', {
          description: 'No duplicate was created (idempotent)',
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
                <div className="flex gap-2 items-center">
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
                  {isAdmin && conversion.status === 'approved' && (
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
    </>
  );
}
