'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { ReferralExtractionSuccessSummary } from '@/lib/workflows/referral-management/import-from-extraction';

type AgreementIntelligenceInputModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onPaste: (text: string) => Promise<boolean>;
  title?: string;
  uploadDescription?: string;
  pasteLabel?: string;
  pastePlaceholder?: string;
  defaultTab?: 'upload' | 'paste';
  loadingTitle?: string;
  loadingDescription?: string;
  closeOnSuccess?: boolean;
  error?: string | null;
  success?: ReferralExtractionSuccessSummary | null;
  review?: React.ReactNode;
  onReviewParticipant?: () => void;
  onInviteParticipant?: () => void;
  onDone?: () => void;
};

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function AgreementIntelligenceInputModal({
  open,
  onOpenChange,
  submitting,
  onUpload,
  onPaste,
  title = 'Provide Agreement',
  uploadDescription = 'Upload a PDF, DOCX, TXT, or image of your agreement. Provvy extracts readable text and sends it through the workspace AI Extractor.',
  pasteLabel = 'Agreement text',
  pastePlaceholder = 'Paste the full agreement text here…',
  defaultTab = 'upload',
  loadingTitle = 'Extracting details from conversation…',
  loadingDescription = 'Identifying participant, referral terms and eligible services.',
  closeOnSuccess = true,
  error = null,
  success = null,
  review = null,
  onReviewParticipant,
  onInviteParticipant,
  onDone,
}: AgreementIntelligenceInputModalProps) {
  const [pasteText, setPasteText] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setPasteText('');
      setLocalError(null);
    }
  }, [open]);

  const handlePasteSubmit = async () => {
    setLocalError(null);
    if (!pasteText.trim()) {
      setLocalError('Paste agreement text to continue.');
      return;
    }
    const ok = await onPaste(pasteText.trim());
    if (ok && closeOnSuccess) onOpenChange(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError(null);
    const ok = await onUpload(file);
    if (ok && closeOnSuccess) onOpenChange(false);
  };

  const visibleError = localError || error;
  const close = () => {
    if (success) {
      onDone?.();
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) (next ? onOpenChange(true) : close()); }}>
      <DialogContent
        showCloseButton={!submitting}
        className={cn(
          'max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-xl',
          review && !success && !submitting && 'sm:max-w-2xl'
        )}
      >
        {submitting ? (
          <>
            <DialogHeader>
              <DialogTitle>{loadingTitle}</DialogTitle>
              <DialogDescription>{loadingDescription}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4 text-center sm:py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            </div>
          </>
        ) : success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                Promoter created
              </DialogTitle>
              <DialogDescription>
                {success.participantName} has been added to your Referral Management workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {success.nextStep ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Next step
                  </p>
                  <p className="mt-1 text-sm text-foreground">{success.nextStep}</p>
                </div>
              ) : null}
              <div className="space-y-4 rounded-xl border border-border bg-secondary/20 p-4">
                <SummaryRow label="Commission" value={success.commission} />
                <SummaryRow
                  label="Eligible services"
                  value={
                    success.eligibleServices.length > 0 ? (
                      <ul className="space-y-1">
                        {success.eligibleServices.map((service) => (
                          <li key={service}>{service}</li>
                        ))}
                      </ul>
                    ) : (
                      'None assigned'
                    )
                  }
                />
                <SummaryRow label="Current status" value={success.status} />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              {success.inviteActionLabel ? (
                <Button type="button" className="w-full sm:w-auto" onClick={onInviteParticipant}>
                  {success.inviteActionLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                variant={success.inviteActionLabel ? 'outline' : 'default'}
                className="w-full sm:w-auto"
                onClick={onReviewParticipant}
              >
                Review participant
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onDone}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : review ? (
          <>
            <DialogHeader>
              <DialogTitle>Review extracted relationship</DialogTitle>
              <DialogDescription>
                Review and complete any missing details before saving the participant.
              </DialogDescription>
            </DialogHeader>
            {review}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Upload a file or paste text to extract the commercial details.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue={defaultTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" disabled={submitting}>Upload file</TabsTrigger>
                <TabsTrigger value="paste" disabled={submitting}>Paste text</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 pt-2">
                <p className="text-[13px] text-muted-foreground">{uploadDescription}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(event) => void handleFileChange(event)}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={submitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose agreement file
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="agreement-paste">{pasteLabel}</Label>
                  <Textarea
                    id="agreement-paste"
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    rows={12}
                    placeholder={pastePlaceholder}
                    disabled={submitting}
                    className="field-sizing-fixed max-h-80 resize-none overflow-y-auto text-sm"
                  />
                </div>
                <Button type="button" className="w-full" disabled={submitting} onClick={() => void handlePasteSubmit()}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting…
                    </>
                  ) : (
                    'Extract from text'
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            {visibleError ? (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
                data-testid="extraction-error"
              >
                {error ? (
                  <>
                    <p className="text-[13px] font-medium text-destructive">
                      This conversation could not be extracted.
                    </p>
                    <p className="mt-1 text-[13px] text-destructive/90">{visibleError}</p>
                  </>
                ) : (
                  <p className="text-[13px] text-destructive">{visibleError}</p>
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
