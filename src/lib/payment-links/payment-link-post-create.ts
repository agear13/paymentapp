import { getFxService, type Currency } from '@/lib/fx';
import { generateQRCodeDataUrl } from '@/lib/qr-code';
import config from '@/lib/config/env';
import { queueXeroSync } from '@/lib/xero/queue-service';
import { loggers } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';

/**
 * FX snapshots, QR warmup, and initial Xero INVOICE queue — runs after the DB row exists.
 * Used by POST /api/payment-links and the recurring templates scheduler.
 */
export async function runPaymentLinkPostCreateEffects(params: {
  paymentLinkId: string;
  organizationId: string;
  invoiceCurrency: string;
  shortCode: string;
}): Promise<void> {
  const { paymentLinkId, organizationId, invoiceCurrency, shortCode } = params;

  loggers.payment.info(
    { paymentLinkId, invoiceCurrency },
    'FX_CREATION_START'
  );
  try {
    const fxService = getFxService();
    const snapshots = await fxService.captureAllCreationSnapshots(
      paymentLinkId,
      invoiceCurrency as Currency
    );
    const tokenList =
      snapshots?.map(
        (s) =>
          (s as { token_type?: string | null }).token_type ??
          (s as { tokenType?: string }).tokenType
      ) ?? [];
    loggers.payment.info(
      {
        paymentLinkId,
        snapshotCount: snapshots?.length ?? 0,
        tokens: tokenList,
      },
      'FX_CREATION_SUCCESS'
    );
  } catch (fxError: unknown) {
    const err = fxError instanceof Error ? fxError : new Error(String(fxError));
    loggers.payment.error(
      {
        paymentLinkId,
        invoiceCurrency,
        errName: err.name,
        errMessage: err.message,
        stack: err.stack,
        cause: err.cause != null ? String(err.cause) : undefined,
      },
      'FX_CREATION_FAIL'
    );
  }

  generateQRCodeDataUrl(shortCode).catch((error) => {
    loggers.payment.error({ paymentLinkId, error }, 'Failed to generate QR code');
  });

  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { status: true },
  });
  if (config.features.xeroSync && link?.status === 'OPEN') {
    try {
      await queueXeroSync({
        paymentLinkId,
        organizationId,
        syncType: 'INVOICE',
      });
    } catch (queueError: unknown) {
      loggers.xero.error(
        'Failed to queue initial Xero invoice sync',
        {
          paymentLinkId,
          organizationId,
          error: queueError instanceof Error ? queueError.message : String(queueError),
        }
      );
    }
  }
}
