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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_ADVOCATE_PERCENT,
  MAX_ADVOCATE_PERCENT,
  computeSplitPreview,
  validateAdvocatePercent,
} from '@/lib/referrals/share-templates';
import { ShareLinkModal } from './share-link-modal';

interface CreateAdvocateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programSlug: string;
  ownerPercent: number;
  onSuccess?: () => void;
}

export function CreateAdvocateModal({
  open,
  onOpenChange,
  programSlug,
  ownerPercent,
  onSuccess,
}: CreateAdvocateModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [serviceLabel, setServiceLabel] = useState('');
  const [advocatePercent, setAdvocatePercent] = useState(DEFAULT_ADVOCATE_PERCENT);
  const [exampleGross, setExampleGross] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<{
    link: string;
    templates: { subject: string; emailBody: string; whatsapp: string; sms: string };
  } | null>(null);

  const { valid, consultantRemainder } = validateAdvocatePercent(advocatePercent, ownerPercent);
  const preview = computeSplitPreview(exampleGross, ownerPercent, advocatePercent);

  const handleCreate = async () => {
    if (!valid) {
      toast.error('Consultant remainder must be positive');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/referrals/advocates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programSlug,
          name: name || undefined,
          email: email || undefined,
          advocatePercent,
          serviceLabel: serviceLabel || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create advocate link');
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      setShareData({
        link: `${baseUrl}${data.link}`,
        templates: data.shareTemplates,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShare = () => {
    setShareData(null);
    setName('');
    setEmail('');
    setServiceLabel('');
    setAdvocatePercent(DEFAULT_ADVOCATE_PERCENT);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Referral Link for Client</DialogTitle>
            <DialogDescription>
              Generate a unique link for a client advocate. They earn a commission when their referrals convert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="advName">Client name (optional)</Label>
                <Input
                  id="advName"
                  placeholder="Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="advEmail">Client email (optional)</Label>
                <Input
                  id="advEmail"
                  type="email"
                  placeholder="client@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="serviceLabel">Service label (optional)</Label>
              <Input
                id="serviceLabel"
                placeholder="my services"
                value={serviceLabel}
                onChange={(e) => setServiceLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used in share templates: &quot;referral link for [service]&quot;
              </p>
            </div>

            <div>
              <Label>Advocate commission: {advocatePercent}%</Label>
              <Slider
                value={[advocatePercent]}
                onValueChange={([v]) => setAdvocatePercent(v ?? DEFAULT_ADVOCATE_PERCENT)}
                min={0}
                max={MAX_ADVOCATE_PERCENT}
                step={1}
                className="mt-2"
              />
              {!valid && (
                <p className="text-sm text-destructive mt-1">
                  Consultant remainder would be {consultantRemainder.toFixed(1)}%. Must be positive.
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <Label>Split preview (example ${exampleGross})</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={exampleGross}
                  onChange={(e) => setExampleGross(parseFloat(e.target.value) || 1000)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">gross</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded bg-muted/50 p-2">
                  <div className="font-medium">BD Partner</div>
                  <div>{preview.ownerPct}% = ${preview.ownerAmount.toFixed(2)}</div>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <div className="font-medium">Advocate</div>
                  <div>{preview.advocatePct}% = ${preview.advocateAmount.toFixed(2)}</div>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <div className="font-medium">You</div>
                  <div>{preview.consultantPct}% = ${preview.consultantAmount.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading || !valid}>
              {loading ? 'Creating...' : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Create link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareData && (
        <ShareLinkModal
          open={!!shareData}
          onOpenChange={(o) => !o && handleCloseShare()}
          link={shareData.link}
          templates={shareData.templates}
          title="Share advocate link"
          description="Send this link to your client. They earn a commission when their referrals convert."
        />
      )}
    </>
  );
}
