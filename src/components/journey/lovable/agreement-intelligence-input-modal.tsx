'use client';

import * as React from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AgreementIntelligenceInputModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onPaste: (text: string) => Promise<boolean>;
};

export function AgreementIntelligenceInputModal({
  open,
  onOpenChange,
  submitting,
  onUpload,
  onPaste,
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
    if (ok) onOpenChange(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError(null);
    const ok = await onUpload(file);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Provide Agreement</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground">
              Upload a PDF, DOCX, TXT, or image of your agreement. Provvy extracts readable text
              and sends it through the workspace AI Extractor.
            </p>
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
              <Label htmlFor="agreement-paste">Agreement text</Label>
              <Textarea
                id="agreement-paste"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={12}
                placeholder="Paste the full agreement text here…"
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

        {localError && (
          <p className="text-[13px] text-destructive">{localError}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
