'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MAX_ADVOCATE_PERCENT, validateAdvocatePercent, computeSplitPreview } from '@/lib/referrals/share-templates';
import { toast } from 'sonner';

interface EditAdvocateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advocate: { id: string; name: string; custom_commission_percent: number };
  ownerPercent: number;
  onSuccess?: () => void;
}

export function EditAdvocateModal({
  open,
  onOpenChange,
  advocate,
  ownerPercent,
  onSuccess,
}: EditAdvocateModalProps) {
  const [advocatePercent, setAdvocatePercent] = useState(advocate.custom_commission_percent);
  const [loading, setLoading] = useState(false);

  const { valid } = validateAdvocatePercent(advocatePercent, ownerPercent);
  const preview = computeSplitPreview(1000, ownerPercent, advocatePercent);

  const handleSave = async () => {
    if (!valid) {
      toast.error('Consultant remainder must be positive');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/referrals/advocates/${advocate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advocatePercent }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update');
      }

      toast.success('Updated. Affects future referrals only.');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit commission: {advocate.name}</DialogTitle>
          <DialogDescription>
            Affects future referrals only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Advocate commission: {advocatePercent}%</Label>
            <Slider
              value={[advocatePercent]}
              onValueChange={([v]) => setAdvocatePercent(v ?? 0)}
              min={0}
              max={MAX_ADVOCATE_PERCENT}
              step={1}
              className="mt-2"
            />
            {!valid && (
              <p className="text-sm text-destructive mt-1">
                Consultant remainder would be negative. Reduce advocate %.
              </p>
            )}
          </div>
          <div className="rounded-lg border p-2 text-sm text-muted-foreground">
            Preview (on $1000): You get ${preview.consultantAmount.toFixed(2)} ({preview.consultantPct}%)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !valid}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
