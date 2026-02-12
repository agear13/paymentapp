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
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { ShareLinkModal } from './share-link-modal';

interface CollectReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programSlug: string;
  onSuccess?: () => void;
}

export function CollectReviewModal({
  open,
  onOpenChange,
  programSlug,
  onSuccess,
}: CollectReviewModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [shareTemplates, setShareTemplates] = useState<{
    subject: string;
    emailBody: string;
    whatsapp: string;
    sms: string;
  } | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/referrals/reviews/create-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programSlug,
          clientName: clientName || undefined,
          clientEmail: clientEmail || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create review link');
      }

      setReviewUrl(data.reviewUrl);
      setShareTemplates(data.shareTemplates);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create review link');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReviewUrl(null);
    setShareTemplates(null);
    setClientName('');
    setClientEmail('');
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Collect Review</DialogTitle>
            <DialogDescription>
              Generate a unique review link to send to your client. They can leave feedback without needing an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client name (optional)</Label>
              <Input
                id="clientName"
                placeholder="Jane"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Client email (optional)</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="jane@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? 'Generating...' : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Generate review link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reviewUrl && shareTemplates && (
        <ShareLinkModal
          open={!!reviewUrl}
          onOpenChange={(o) => !o && handleClose()}
          link={reviewUrl}
          templates={shareTemplates}
          title="Share review link"
          description="Thanks for working with me — would you mind leaving a quick review?"
        />
      )}
    </>
  );
}
