/**
 * GET /api/public/pay/[shortCode]/attachment
 * Stream invoice attachment bytes for the pay page from private object storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';
import {
  downloadPaymentLinkAttachmentFromStorage,
  isValidPaymentLinkAttachmentStorageKey,
  PAYMENT_LINK_ATTACHMENT_BUCKET,
} from '@/lib/payment-links/payment-link-attachment';

function dispositionFilename(name: string | null | undefined): string {
  const n = name?.trim().replace(/[^\w.\- ]+/g, '_').slice(0, 200);
  return n || 'attachment';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { shortCode } = await params;
    if (!isValidShortCode(shortCode)) {
      return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
    }

    const link = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
      select: {
        id: true,
        status: true,
        attachment_storage_key: true,
        attachment_bucket: true,
        attachment_filename: true,
        attachment_mime_type: true,
      },
    });

    if (!link) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (link.status === 'DRAFT' || link.status === 'CANCELED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const storageKey = link.attachment_storage_key;
    const bucket = link.attachment_bucket?.trim() || PAYMENT_LINK_ATTACHMENT_BUCKET;
    if (!storageKey || !isValidPaymentLinkAttachmentStorageKey(storageKey)) {
      return NextResponse.json({ error: 'No attachment' }, { status: 404 });
    }

    let buffer: Buffer;
    try {
      buffer = await downloadPaymentLinkAttachmentFromStorage(bucket, storageKey);
    } catch (downloadError: unknown) {
      const message = downloadError instanceof Error ? downloadError.message : 'Attachment file unavailable';
      loggers.api.warn({ shortCode, bucket, storageKey, error: message }, 'Invoice attachment fetch failed');
      return NextResponse.json({ error: 'Attachment file unavailable' }, { status: 404 });
    }
    const mime = link.attachment_mime_type?.trim() || 'application/octet-stream';
    const inline = mime.startsWith('image/') || mime === 'application/pdf';
    const filename = dispositionFilename(link.attachment_filename);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'GET public pay attachment failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
