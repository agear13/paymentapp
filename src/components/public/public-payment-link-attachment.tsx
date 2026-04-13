/**
 * Merchant-uploaded payment instruction attachment on the public pay/invoice page.
 */

'use client';

import { FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PublicPaymentLinkAttachmentProps {
  attachmentUrl: string;
  attachmentFilename?: string | null;
  attachmentMimeType?: string | null;
}

export function PublicPaymentLinkAttachment({
  attachmentUrl,
  attachmentFilename,
  attachmentMimeType,
}: PublicPaymentLinkAttachmentProps) {
  const mime = attachmentMimeType ?? '';
  const isPdf = mime === 'application/pdf' || attachmentUrl.toLowerCase().endsWith('.pdf');
  const isImage = mime.startsWith('image/') || (!isPdf && /\.(png|jpe?g)$/i.test(attachmentUrl));

  const label = attachmentFilename?.trim() || (isPdf ? 'PDF document' : 'Image');

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 space-y-3" aria-label="Payment instructions attachment">
      <h2 className="text-base font-semibold text-slate-900">Payment instructions attachment</h2>
      <p className="text-sm text-slate-600">
        Your merchant included an extra file with this invoice (for example a QR code or bank instructions).
      </p>

      {isImage ? (
        <div className="space-y-2">
          <div className="flex justify-center rounded-md border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- public uploads URL; dynamic merchant content */}
            <img
              src={attachmentUrl}
              alt={label}
              className="max-h-[min(70vh,480px)] w-full max-w-md object-contain"
            />
          </div>
          <p className="text-center">
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Open full size in new tab
            </a>
          </p>
        </div>
      ) : null}

      {isPdf || !isImage ? (
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600 shrink-0" aria-hidden />
          <span className="text-sm text-slate-800 break-all">{label}</span>
          <Button variant="secondary" size="sm" asChild>
            <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" download>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open / download
            </a>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
