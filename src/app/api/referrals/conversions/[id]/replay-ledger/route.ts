import { NextRequest, NextResponse } from 'next/server';
import { createPartnerLedgerEntryForReferralConversion } from '@/lib/referrals/partners-integration';
import { checkAdminAuth } from '@/lib/auth/admin.server';

/**
 * POST /api/referrals/conversions/[id]/replay-ledger
 * Admin-only: Deterministically trigger ledger entry creation for a referral conversion.
 * Idempotent: Returns success if inserted or if entry already exists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversionId = params.id;

    if (!conversionId) {
      return NextResponse.json(
        { error: 'Conversion ID is required' },
        { status: 400 }
      );
    }

    // Verify Supabase auth session (user client)
    const { isAdmin, user, error: authError } = await checkAdminAuth();

    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: authError || 'Forbidden' },
        { status: authError === 'Authentication required' ? 401 : 403 }
      );
    }

    console.log('[REFERRAL_REPLAY_LEDGER] Admin triggered replay:', {
      conversionId,
      adminEmail: user.email,
    });

    try {
      const result = await createPartnerLedgerEntryForReferralConversion(conversionId, {
        isReplay: true,
      });

      return NextResponse.json({
        success: true,
        created: result.created,
        skipped: result.skipped,
        message:
          result.created > 0
            ? `Created ${result.created} ledger entries`
            : result.skipped > 0
              ? `All entries already exist (idempotent): ${result.skipped} skipped`
              : 'No ledger entries created',
      });
    } catch (ledgerError) {
      const errorMessage = ledgerError instanceof Error ? ledgerError.message : 'Unknown error';
      const errorDetails = ledgerError instanceof Error ? ledgerError.stack : String(ledgerError);

      console.error('[REFERRAL_REPLAY_LEDGER] Failed:', errorMessage, errorDetails);

      return NextResponse.json(
        {
          error: 'Failed to create ledger entry',
          details: errorMessage,
          conversionId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[REFERRAL_REPLAY_LEDGER] Route error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
