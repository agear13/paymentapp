'use client';

import * as React from 'react';
import { Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ExtractionResult, ExtractorEntryPoint, SourceType } from '@/lib/ai-extractor/extraction-types';
import { SOURCE_TYPE_LABELS } from '@/lib/ai-extractor/extraction-types';

const SOURCE_TYPES: SourceType[] = ['whatsapp', 'email', 'slack', 'sms', 'meeting_notes', 'other'];

const EXAMPLE_CONVERSATION = `Hey Alex, just confirming everything for the NYE event at Ku De Ta.

You'll be performing from 10pm through to 2am on December 31st.

We've agreed on a flat fee of IDR 15,000,000 for the night — I'll get payment sorted once I have your bank details.

Also looping in Sarah from promotions — she's bringing in the crowd so we'll give her 10% of bar revenue on the night.

Let me know if you need anything else sorted before the event.

Thanks,
Mike
Ku De Ta`;

interface ConversationInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryPoint: ExtractorEntryPoint;
  onExtracted: (result: ExtractionResult, sourceType: SourceType, rawText: string) => void;
}

export function ConversationInputModal({
  open,
  onOpenChange,
  entryPoint,
  onExtracted,
}: ConversationInputModalProps) {
  const [sourceType, setSourceType] = React.useState<SourceType>('whatsapp');
  const [rawText, setRawText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showExample, setShowExample] = React.useState(false);

  const charCount = rawText.length;
  const MAX_CHARS = 50_000;

  const handleExtract = React.useCallback(async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-extractor/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rawText: rawText.trim(), sourceHint: SOURCE_TYPE_LABELS[sourceType] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? 'Extraction failed. Please try again.');
        return;
      }
      const result = await res.json() as ExtractionResult;
      onOpenChange(false);
      onExtracted(result, sourceType, rawText.trim());
    } catch {
      setError('Could not reach the extraction service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [rawText, sourceType, onExtracted, onOpenChange]);

  const handleClose = () => {
    if (loading) return;
    setRawText('');
    setError(null);
    setShowExample(false);
    onOpenChange(false);
  };

  const titleMap: Record<ExtractorEntryPoint, string> = {
    project_create: 'Create From Conversation',
    participant_add: 'Create From Conversation',
    onboarding: 'Create From Conversation',
  };

  const descMap: Record<ExtractorEntryPoint, string> = {
    project_create: 'Paste a conversation and Provvypay will extract the project, participants, and payment arrangements.',
    participant_add: 'Paste a conversation and Provvypay will extract participants and payment arrangements to add to this project.',
    onboarding: 'Paste a conversation and Provvypay will extract who needs to get paid and how.',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex min-h-0 flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {titleMap[entryPoint]}
          </DialogTitle>
          <DialogDescription>{descMap[entryPoint]}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-smooth px-6 py-2">
          {/* Source type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Source type</Label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_TYPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSourceType(s)}
                  className={cn(
                    'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                    sourceType === s
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent/40'
                  )}
                >
                  {SOURCE_TYPE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Paste your conversation below
            </Label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste your ${SOURCE_TYPE_LABELS[sourceType]} conversation here…`}
              rows={8}
              className="field-sizing-fixed min-h-[12rem] max-h-[min(24rem,40vh)] resize-none overflow-y-auto text-sm whitespace-pre-wrap"
              disabled={loading}
              maxLength={MAX_CHARS}
            />
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowExample((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showExample ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                View example conversation
              </button>
              <span className={cn('text-xs text-muted-foreground', charCount > MAX_CHARS * 0.9 && 'text-amber-600')}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </div>

            {showExample && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Example — hospitality event agreement</p>
                <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                  {EXAMPLE_CONVERSATION}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setRawText(EXAMPLE_CONVERSATION);
                    setSourceType('whatsapp');
                    setShowExample(false);
                  }}
                >
                  Use this example
                </Button>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExtract}
            disabled={loading || !rawText.trim() || charCount > MAX_CHARS}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting…
              </>
            ) : (
              'Extract →'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}