import { NextRequest, NextResponse } from 'next/server';
import { findParticipantByPaymentSetupToken } from '@/lib/commercial/payment-setup.server';
import { getAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { Prisma } from '@prisma/client';
import type { PaymentAttachment } from '@/lib/commercial/payment-setup-types';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'image/heic',
  'image/heif',
];

/**
 * POST /api/payment-setup/[token]/upload
 *
 * Public endpoint — authenticated by payment setup token.
 * Accepts multipart form data with a single file.
 * Stores the file using the existing agreement upload storage (R2 / local).
 * Appends attachment metadata to participant_payload.paymentSetup.attachments.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const tokenResult = await findParticipantByPaymentSetupToken(token);
    if (!tokenResult) {
      return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'File type not supported. Upload an image (JPG, PNG, WebP) or PDF.' },
        { status: 400 }
      );
    }

    const { participant, participantDbId } = tokenResult;
    const attachmentId = uuidv4();
    const storageKey = `payment-setup/${participantDbId}/${attachmentId}`;

    // Upload to storage
    const bytes = Buffer.from(await file.arrayBuffer());
    const storage = getAgreementUploadStorage();
    await storage.upload({
      storageKey,
      bytes,
      mimeType,
      originalFilename: file.name,
    });

    // Append attachment metadata
    const attachment: PaymentAttachment = {
      id: attachmentId,
      storageKey,
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };

    const existingAttachments = participant.paymentSetup?.attachments ?? [];
    const updated: DemoParticipant = {
      ...participant,
      paymentSetup: {
        ...participant.paymentSetup,
        attachments: [...existingAttachments, attachment],
      },
    };

    await prisma.deal_network_pilot_participants.update({
      where: { id: participantDbId },
      data: { participant_payload: updated as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ attachment });
  } catch (e) {
    console.error('[payment-setup/upload POST]', e);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
