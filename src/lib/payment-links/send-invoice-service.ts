import 'server-only';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { checkUserPermission } from '@/lib/auth/permissions';
import { sendInvoiceEmail } from '@/lib/email/send-invoice-email';
import {
  downloadPaymentLinkAttachmentFromStorage,
  isValidPaymentLinkAttachmentStorageKey,
  PAYMENT_LINK_ATTACHMENT_BUCKET,
  PAYMENT_LINK_ATTACHMENT_MAX_BYTES,
} from '@/lib/payment-links/payment-link-attachment';

export const SendInvoiceBodySchema = z.object({
  email: z.string().email('Enter a valid client email address.'),
});

const SENDABLE_STATUSES = new Set(['DRAFT', 'OPEN', 'PAID_UNVERIFIED']);

export async function sendInvoiceForPaymentLink(params: {
  paymentLinkId: string;
  userId: string;
  email: string;
  origin: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const link = await prisma.payment_links.findUnique({
    where: { id: params.paymentLinkId },
    select: {
      id: true,
      short_code: true,
      status: true,
      organization_id: true,
      amount: true,
      currency: true,
      description: true,
      invoice_reference: true,
      attachment_storage_key: true,
      attachment_bucket: true,
      attachment_filename: true,
      attachment_mime_type: true,
      attachment_size_bytes: true,
      organizations: { select: { name: true } },
    },
  });

  if (!link) {
    return { ok: false as const, status: 404, error: 'Invoice not found' };
  }

  const canEdit = await checkUserPermission(
    params.userId,
    link.organization_id,
    'edit_payment_links'
  );
  if (!canEdit) {
    return {
      ok: false as const,
      status: 403,
      error: 'You do not have permission to send invoices for this organization.',
    };
  }

  if (!SENDABLE_STATUSES.has(link.status)) {
    return {
      ok: false as const,
      status: 400,
      error: `Invoice cannot be sent in current status (${link.status}).`,
    };
  }

  const paymentUrl = `${params.origin}/pay/${encodeURIComponent(link.short_code)}`;
  let emailAttachment:
    | {
        filename: string;
        mimeType?: string | null;
        contentBase64: string;
      }
    | undefined;

  const attachmentStorageKey = link.attachment_storage_key?.trim() || '';
  if (attachmentStorageKey && isValidPaymentLinkAttachmentStorageKey(attachmentStorageKey)) {
    const knownSize = link.attachment_size_bytes ?? 0;
    if (knownSize > PAYMENT_LINK_ATTACHMENT_MAX_BYTES) {
      return {
        ok: false as const,
        status: 400,
        error: 'Invoice attachment is too large to send by email.',
      };
    }

    try {
      const bucket = link.attachment_bucket?.trim() || PAYMENT_LINK_ATTACHMENT_BUCKET;
      const fileBuffer = await downloadPaymentLinkAttachmentFromStorage(
        bucket,
        attachmentStorageKey
      );
      if (fileBuffer.length > PAYMENT_LINK_ATTACHMENT_MAX_BYTES) {
        return {
          ok: false as const,
          status: 400,
          error: 'Invoice attachment is too large to send by email.',
        };
      }

      emailAttachment = {
        filename: (link.attachment_filename?.trim() || 'invoice-attachment').slice(0, 255),
        mimeType: link.attachment_mime_type ?? undefined,
        contentBase64: fileBuffer.toString('base64'),
      };
    } catch {
      return {
        ok: false as const,
        status: 404,
        error: 'Invoice attachment file unavailable. Re-upload attachment and try again.',
      };
    }
  }

  const sendResult = await sendInvoiceEmail({
    toEmail: normalizedEmail,
    paymentUrl,
    merchantName: link.organizations?.name || 'Provvypay',
    invoice: {
      id: link.id,
      shortCode: link.short_code,
      amount: Number(link.amount),
      currency: link.currency,
      description: link.description,
      invoiceReference: link.invoice_reference,
    },
    attachment: emailAttachment,
  });

  if (!sendResult.success) {
    return {
      ok: false as const,
      status: 502,
      error: sendResult.error || 'Could not send invoice email.',
    };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: link.id,
        // Reuse an existing enum value; delivery details are captured in metadata.
        event_type: 'CREATED',
        metadata: {
          channel: 'email',
          email: normalizedEmail,
          providerMessageId: sendResult.providerMessageId ?? null,
          sentBy: params.userId,
          sentAt: now.toISOString(),
        },
        created_at: now,
      },
    });

    await tx.payment_links.update({
      where: { id: link.id },
      data: {
        last_sent_at: now,
        last_sent_to_email: normalizedEmail,
        updated_at: now,
      },
    });
  });

  return { ok: true as const };
}

