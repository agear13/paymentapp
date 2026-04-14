/**
 * POST /api/payment-links/upload-attachment
 * Merchant upload for invoice payment instructions (PNG, JPEG, PDF). Payment Links app only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import {
  buildPaymentLinkAttachmentStorageKey,
  PAYMENT_LINK_ATTACHMENT_MAX_BYTES,
  PAYMENT_LINK_ATTACHMENT_BUCKET,
  isAllowedPaymentLinkAttachmentMime,
  sanitizeOriginalFilename,
  uploadPaymentLinkAttachmentToStorage,
} from '@/lib/payment-links/payment-link-attachment';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const organizationId = (formData.get('organizationId') as string) || '';
    const paymentLinkId = (formData.get('paymentLinkId') as string) || '';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const mime = file.type;
    if (!isAllowedPaymentLinkAttachmentMime(mime)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, JPEG, PDF.' },
        { status: 400 }
      );
    }

    if (file.size > PAYMENT_LINK_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${PAYMENT_LINK_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    if (paymentLinkId) {
      const link = await prisma.payment_links.findUnique({
        where: { id: paymentLinkId },
        select: { id: true, organization_id: true, status: true },
      });
      if (!link || link.organization_id !== organizationId) {
        return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
      }
      if (link.status !== 'DRAFT' && link.status !== 'OPEN') {
        return NextResponse.json(
          { error: 'Attachment can only be changed while the invoice is draft or open.' },
          { status: 400 }
        );
      }
      const canEdit = await checkUserPermission(auth.user.id, organizationId, 'edit_payment_links');
      if (!canEdit) {
        return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
      }
    } else {
      const canCreate = await checkUserPermission(auth.user.id, organizationId, 'create_payment_links');
      if (!canCreate) {
        return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
      }
    }

    const bytes = await file.arrayBuffer();
    const storageKey = buildPaymentLinkAttachmentStorageKey(organizationId, mime);
    await uploadPaymentLinkAttachmentToStorage({
      bucket: PAYMENT_LINK_ATTACHMENT_BUCKET,
      storageKey,
      bytes: Buffer.from(bytes),
      mimeType: mime,
    });

    const safeOriginalName = sanitizeOriginalFilename(file.name);

    loggers.api.info(
      {
        userId: auth.user.id,
        organizationId,
        paymentLinkId: paymentLinkId || null,
        bucket: PAYMENT_LINK_ATTACHMENT_BUCKET,
        storageKey,
        sizeBytes: file.size,
        mime,
      },
      'Payment link attachment uploaded'
    );

    return NextResponse.json({
      success: true,
      attachment: {
        storageKey,
        bucket: PAYMENT_LINK_ATTACHMENT_BUCKET,
        filename: safeOriginalName,
        mimeType: mime,
        sizeBytes: file.size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    loggers.api.error({ error: message }, 'payment-links upload-attachment failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
