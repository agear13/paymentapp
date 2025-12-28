/**
 * Payment Link QR Code API
 * GET /api/payment-links/[id]/qr-code - Get or download QR code
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { 
  generateQRCodeDataUrl,
  generateQRCodeBuffer,
  generateQRCodeSVG,
  getQRCodeFilename,
} from '@/lib/qr-code';

/**
 * GET /api/payment-links/[id]/qr-code
 * Get QR code in various formats
 * Query params:
 * - format: 'dataurl' | 'png' | 'svg' (default: 'dataurl')
 * - download: 'true' | 'false' (default: 'false')
 * - size: number (default: 300)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting (higher limit for QR codes)
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'dataurl';
    const download = searchParams.get('download') === 'true';
    const size = parseInt(searchParams.get('size') || '300', 10);

    // Get payment link
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        shortCode: true,
        invoiceReference: true,
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canView = await checkUserPermission(
      user.id,
      paymentLink.organizationId,
      'view_payment_links'
    );
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Generate QR code based on format
    if (format === 'svg') {
      const svg = await generateQRCodeSVG(paymentLink.shortCode, { size });
      
      const headers: HeadersInit = {
        'Content-Type': 'image/svg+xml',
      };

      if (download) {
        const filename = getQRCodeFilename(
          paymentLink.shortCode,
          paymentLink.invoiceReference
        ).replace('.png', '.svg');
        headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      }

      return new NextResponse(svg, { headers });
    } else if (format === 'png') {
      const buffer = await generateQRCodeBuffer(paymentLink.shortCode, { size });
      
      const headers: HeadersInit = {
        'Content-Type': 'image/png',
      };

      if (download) {
        const filename = getQRCodeFilename(
          paymentLink.shortCode,
          paymentLink.invoiceReference
        );
        headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      }

      return new NextResponse(buffer, { headers });
    } else {
      // Default: dataurl
      const dataUrl = await generateQRCodeDataUrl(paymentLink.shortCode, { size });

      loggers.api.debug(
        { paymentLinkId: id, shortCode: paymentLink.shortCode },
        'Generated QR code'
      );

      return NextResponse.json({
        data: {
          qrCode: dataUrl,
          shortCode: paymentLink.shortCode,
        },
      });
    }
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, paymentLinkId: params.id },
      'Failed to generate QR code'
    );
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




