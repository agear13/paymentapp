'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, Copy, Download, ExternalLink, Loader2, Share2 } from 'lucide-react';

export type ReferralSharePanelProps = {
  code: string;
  referralUrl: string;
  qrUrl: string;
  status?: string;
  vanityPath?: string | null;
  createdAt?: string | null;
  participantLabel?: string;
  compact?: boolean;
};

export function ReferralSharePanel({
  code,
  referralUrl,
  qrUrl,
  status = 'ACTIVE',
  vanityPath,
  createdAt,
  participantLabel,
  compact = false,
}: ReferralSharePanelProps) {
  const [copied, setCopied] = React.useState(false);
  const [qrState, setQrState] = React.useState<'loading' | 'ready' | 'error'>('loading');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Try selecting the link manually.');
    }
  };

  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Referral link',
          text: `Pay via referral ${code}`,
          url: referralUrl,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await copyLink();
  };

  const downloadQr = () => {
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `referral-${code}-qr.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR download started');
  };

  const openQr = () => {
    window.open(qrUrl, '_blank', 'noopener,noreferrer');
  };

  const createdLabel =
    createdAt && !Number.isNaN(new Date(createdAt).getTime())
      ? new Date(createdAt).toLocaleDateString()
      : null;

  const shellClass = compact
    ? 'flex flex-col gap-3 rounded-lg border border-gray-100 p-3'
    : 'flex flex-col sm:flex-row gap-4 rounded-lg border border-gray-100 p-4';

  return (
    <div className={shellClass}>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-semibold">{code}</span>
          <Badge variant={status === 'ACTIVE' ? 'default' : 'secondary'}>{status}</Badge>
        </div>
        {participantLabel ? (
          <p className="text-sm text-muted-foreground">{participantLabel}</p>
        ) : null}
        {vanityPath ? (
          <p className="text-xs text-muted-foreground">
            Vanity URL: <span className="font-mono">{vanityPath}</span>
          </p>
        ) : null}
        <p className="text-sm text-blue-600 break-all">{referralUrl}</p>
        {createdLabel ? (
          <p className="text-xs text-muted-foreground">Created {createdLabel}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" variant="default" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={shareNative}>
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={referralUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </a>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={downloadQr}>
            <Download className="h-4 w-4 mr-1" />
            Download QR
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={openQr}>
            Open QR
          </Button>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-center gap-2">
        <div className="relative w-[140px] h-[140px] rounded border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
          {qrState === 'loading' ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : null}
          {qrState === 'error' ? (
            <p className="text-xs text-center text-muted-foreground px-2">QR unavailable</p>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`QR code for referral ${code}`}
            width={140}
            height={140}
            className={qrState === 'ready' ? 'block' : 'hidden'}
            onLoad={() => setQrState('ready')}
            onError={() => setQrState('error')}
          />
        </div>
        <span className="text-xs text-muted-foreground">Scan to open</span>
      </div>
    </div>
  );
}
