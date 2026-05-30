'use client';

import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExtractionResult, ExtractorEntryPoint, SourceType } from '@/lib/ai-extractor/extraction-types';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { ConversationInputModal } from './conversation-input-modal';
import { ExtractionReviewModal } from './extraction-review-modal';

interface CreateFromConversationButtonProps {
  entryPoint: ExtractorEntryPoint;
  /** Entry Point B — the project being added to. */
  existingDeal?: RecentDeal;
  /** Entry Point B — existing participants for duplicate detection. */
  existingParticipants?: DemoParticipant[];
  /** Entry Point A: receives new dealId. Entry Point B: no args. Entry Point C: receives participants. */
  onComplete: (dealId?: string, participants?: DemoParticipant[]) => void;
  /** Optional className forwarded to the button. */
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}

export function CreateFromConversationButton({
  entryPoint,
  existingDeal,
  existingParticipants,
  onComplete,
  className,
  variant = 'outline',
  size = 'default',
}: CreateFromConversationButtonProps) {
  const [inputOpen, setInputOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [extractionResult, setExtractionResult] = React.useState<ExtractionResult | null>(null);
  const [sourceType, setSourceType] = React.useState<SourceType>('whatsapp');

  const handleExtracted = React.useCallback((result: ExtractionResult, st: SourceType) => {
    setExtractionResult(result);
    setSourceType(st);
    setReviewOpen(true);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setInputOpen(true)}
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Create From Conversation
      </Button>

      <ConversationInputModal
        open={inputOpen}
        onOpenChange={setInputOpen}
        entryPoint={entryPoint}
        onExtracted={handleExtracted}
      />

      {extractionResult && (
        <ExtractionReviewModal
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          result={extractionResult}
          entryPoint={entryPoint}
          sourceType={sourceType}
          existingDeal={existingDeal}
          existingParticipants={existingParticipants}
          onComplete={onComplete}
        />
      )}
    </>
  );
}