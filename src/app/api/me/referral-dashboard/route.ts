import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/server/prisma';

import { requireAuth } from '@/lib/supabase/middleware';

import { applyRateLimit } from '@/lib/rate-limit';

import {

  buildReferralQrUrl,

  buildReferralShareUrl,

  resolveReferralSlug,

} from '@/lib/referrals/referral-share-url';

import { loadReferralCodesForParticipant } from '@/lib/referrals/participant-referral-codes';

import { referralTrace } from '@/lib/referrals/referral-trace';
import { commissionPropagationTrace } from '@/lib/referrals/commission-propagation-trace';



/**

 * Participant self-dashboard: referral visibility by ownership (user id + email binding).

 * Does not require organization membership or view_payment_links on the issuing org.

 */

export async function GET(request: NextRequest) {

  try {

    const rateLimitResult = await applyRateLimit(request, 'api');

    if (!rateLimitResult.success) {

      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    }



    const auth = await requireAuth(request);

    if (!auth.user) return auth.response!;



    referralTrace('api.referralDashboard.auth', {

      userId: auth.user.id,

      userEmail: auth.user.email ?? null,

      scope: 'participantOwnership',

    });



    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');



    const codes = await loadReferralCodesForParticipant({

      participantUserId: auth.user.id,

      participantEmail: auth.user.email,

      bindUserOnEmailMatch: true,

    });



    const invoices = await prisma.payment_links.findMany({

      where: {

        attributed_participant_user_id: auth.user.id,

        referral_link_id: { not: null },

      },

      orderBy: { created_at: 'desc' },

      take: 50,

      select: {

        id: true,

        short_code: true,

        description: true,

        amount: true,

        invoice_currency: true,

        status: true,

        created_at: true,

        organization_service_id: true,

      },

    });



    const obligationItems = await prisma.commission_obligation_items.findMany({

      where: {

        commission_obligations: {

          payment_links: {

            attributed_participant_user_id: auth.user.id,

          },

        },

      },

      include: {

        commission_obligations: {

          select: {

            payment_link_id: true,

            currency: true,

            payment_links: { select: { short_code: true, invoice_reference: true } },

          },

        },

      },

      orderBy: { created_at: 'desc' },

      take: 100,

    });



    referralTrace('api.referralDashboard.result', {

      userId: auth.user.id,

      referralCodesCount: codes.length,

      invoicesCount: invoices.length,

      commissionItemsCount: obligationItems.length,

    });

    commissionPropagationTrace('participant_dashboard_query', {
      userId: auth.user.id,
      commissionItemsCount: obligationItems.length,
      invoicesCount: invoices.length,
    });



    return NextResponse.json({

      data: {

        referralCodes: codes.map((c) => {

          const code = c.code.trim().toUpperCase();

          const slug = resolveReferralSlug({

            code,

            slug: c.slug,

            referralLinkSlug: c.referral_links.slug,

          });

          const shareSource = {

            code,

            slug: c.slug,

            referralLinkSlug: c.referral_links.slug,

          };

          return {

            id: c.id,

            code,

            slug,

            vanityPath: slug ? `/ref/${slug}` : null,

            referralUrl: buildReferralShareUrl(baseUrl || '', shareSource),

            qrUrl: buildReferralQrUrl(baseUrl || '', code),

            createdAt: c.created_at.toISOString(),

          };

        }),

        invoices: invoices.map((i) => ({

          id: i.id,

          shortCode: i.short_code,

          description: i.description,

          amount: Number(i.amount),

          currency: i.invoice_currency,

          status: i.status,

          createdAt: i.created_at.toISOString(),

          serviceId: i.organization_service_id,

        })),

        commissionItems: obligationItems.map((it) => ({

          id: it.id,

          amount: Number(it.amount),

          currency: it.currency,

          status: it.status,

          shortCode: it.commission_obligations.payment_links?.short_code ?? null,

          invoiceReference: it.commission_obligations.payment_links?.invoice_reference ?? null,

        })),

      },

    });

  } catch (error: unknown) {

    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json({ error: message }, { status: 500 });

  }

}

