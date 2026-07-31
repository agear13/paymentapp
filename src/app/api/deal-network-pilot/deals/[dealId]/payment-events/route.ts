import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { refreshDealNetworkPilotObligationsForUser } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import {
  createManualPilotDealPaymentEvent,
  linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal,
  linkPaymentEventToPilotDeal,
} from '@/lib/deal-network-demo/pilot-deal-payment-events.server';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';

const LOG_PREFIX = '[deal-network-pilot/payment-events POST]';

function logPaymentEvents(step: string, payload: Record<string, unknown>): void {
  console.error(LOG_PREFIX, step, JSON.stringify(payload));
}

function logPaymentEventsError(step: string, error: unknown, context: Record<string, unknown> = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    LOG_PREFIX,
    step,
    JSON.stringify({
      ...context,
      errorMessage: err.message,
      errorName: err.name,
      stack: err.stack,
    }),
  );
}

function shouldExposePaymentEventsDebugError(): boolean {
  return process.env.NODE_ENV !== 'production' || isHackathonJourneyEnabled();
}

function paymentEvents500Response(error: unknown): NextResponse {
  // TEMP: revert after hackathon payment-events 500 is diagnosed
  if (shouldExposePaymentEventsDebugError()) {
    return NextResponse.json(
      {
        error: String(error),
        message: error instanceof Error ? error.message : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}

async function respondWithFundingSync(
  userId: string,
  dealId: string,
  body: Record<string, unknown>
) {
  logPaymentEvents('before orchestrateOperationalMutation', {
    dealId,
    userId,
    mutation: 'funding_update',
  });

  const operationalSync = await orchestrateOperationalMutation({
    userId,
    mutation: 'funding_update',
    projectId: dealId,
  });

  logPaymentEvents('after orchestrateOperationalMutation', {
    dealId,
    userId,
    fundingAllocated: operationalSync.fundingAllocated,
    obligationCount: operationalSync.obligationCount,
  });

  return NextResponse.json({ ...body, ...operationalSyncJson(operationalSync) });
}

export const dynamic = 'force-dynamic';

type PaymentEventsBody = {
  mode?: 'manual' | 'link_payment_event' | 'link_payment_link';
  amount?: number;
  currency?: string;
  sourceType?: 'MANUAL' | 'CSV_IMPORT';
  sourceReference?: string;
  rawPayloadJson?: unknown;
  receivedAt?: string;
  paymentEventId?: string;
  paymentLinkId?: string;
};

/**
 * POST /api/deal-network-pilot/deals/[dealId]/payment-events
 *
 * Manual / explicit linkage of real payment state to a pilot deal (additive).
 * Modes:
 * - manual (default): record PAYMENT_CONFIRMED without a payment_links row
 * - link_payment_event: attach an existing payment_events row to this deal
 * - link_payment_link: attach latest PAYMENT_CONFIRMED for a payment link to this deal
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> }
) {
  let dealId: string | null = null;
  let organizationId: string | null = null;
  let authenticatedUserId: string | null = null;
  let requestBody: PaymentEventsBody | null = null;

  try {
    logPaymentEvents('request received', {
      method: request.method,
      url: request.url,
    });

    const user = await requireAuth(request);
    authenticatedUserId = user.id;

    const organization = await getOrganizationForAuthenticatedUser(user.id);
    organizationId = organization?.id ?? null;

    const params = await context.params;
    dealId = params.dealId?.trim() ?? null;

    logPaymentEvents('auth resolved', {
      dealId,
      organizationId,
      authenticatedUser: {
        id: user.id,
        email: user.email ?? null,
      },
    });

    if (!dealId) {
      logPaymentEvents('validation failed', {
        dealId,
        organizationId,
        authenticatedUserId,
        validationResult: 'missing dealId path param',
      });
      return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
    }

    requestBody = (await request.json()) as PaymentEventsBody;
    const mode = requestBody.mode ?? 'manual';

    logPaymentEvents('request body parsed', {
      dealId,
      organizationId,
      authenticatedUserId,
      incomingRequestBody: requestBody,
      mode,
      fundingAmount: requestBody.amount ?? null,
    });

    if (mode === 'link_payment_event') {
      const pe = requestBody.paymentEventId?.trim();
      if (!pe) {
        logPaymentEvents('validation failed', {
          dealId,
          organizationId,
          authenticatedUserId,
          mode,
          validationResult: 'paymentEventId required',
        });
        return NextResponse.json({ error: 'paymentEventId required' }, { status: 400 });
      }

      logPaymentEvents('before linkPaymentEventToPilotDeal', {
        dealId,
        organizationId,
        authenticatedUserId,
        paymentEventId: pe,
      });

      const r = await linkPaymentEventToPilotDeal({
        userId: user.id,
        dealId,
        paymentEventId: pe,
      });

      logPaymentEvents('after linkPaymentEventToPilotDeal', {
        dealId,
        ok: r.ok,
        error: r.ok ? null : r.error,
      });

      if (!r.ok) {
        logPaymentEvents('responding 404', {
          dealId,
          organizationId,
          authenticatedUserId,
          reason: r.error,
        });
        return NextResponse.json({ error: r.error }, { status: 404 });
      }

      logPaymentEvents('before refreshDealNetworkPilotObligationsForUser', {
        dealId,
        organizationId,
        authenticatedUserId,
        prismaMutationsExpected: [
          'deal_network_pilot_obligations.deleteMany (per deal)',
          'deal_network_pilot_obligations.createMany (per deal)',
        ],
      });

      await refreshDealNetworkPilotObligationsForUser(user.id);

      logPaymentEvents('after refreshDealNetworkPilotObligationsForUser', {
        dealId,
        organizationId,
        authenticatedUserId,
      });

      return respondWithFundingSync(user.id, dealId, { ok: true, paymentEvent: r.paymentEvent });
    }

    if (mode === 'link_payment_link') {
      const pl = requestBody.paymentLinkId?.trim();
      if (!pl) {
        logPaymentEvents('validation failed', {
          dealId,
          organizationId,
          authenticatedUserId,
          mode,
          validationResult: 'paymentLinkId required',
        });
        return NextResponse.json({ error: 'paymentLinkId required' }, { status: 400 });
      }

      logPaymentEvents('before linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal', {
        dealId,
        organizationId,
        authenticatedUserId,
        paymentLinkId: pl,
      });

      const r = await linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal({
        userId: user.id,
        dealId,
        paymentLinkId: pl,
      });

      logPaymentEvents('after linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal', {
        dealId,
        ok: r.ok,
        error: r.ok ? null : r.error,
      });

      if (!r.ok) {
        logPaymentEvents('responding 404', {
          dealId,
          organizationId,
          authenticatedUserId,
          reason: r.error,
        });
        return NextResponse.json({ error: r.error }, { status: 404 });
      }

      logPaymentEvents('before refreshDealNetworkPilotObligationsForUser', {
        dealId,
        organizationId,
        authenticatedUserId,
        prismaMutationsExpected: [
          'deal_network_pilot_obligations.deleteMany (per deal)',
          'deal_network_pilot_obligations.createMany (per deal)',
        ],
      });

      await refreshDealNetworkPilotObligationsForUser(user.id);

      logPaymentEvents('after refreshDealNetworkPilotObligationsForUser', {
        dealId,
        organizationId,
        authenticatedUserId,
      });

      return respondWithFundingSync(user.id, dealId, { ok: true, paymentEvent: r.paymentEvent });
    }

    const amount = requestBody.amount;
    const currency = requestBody.currency;
    const fundingAmount = amount;

    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      logPaymentEvents('validation failed', {
        dealId,
        organizationId,
        authenticatedUserId,
        incomingRequestBody: requestBody,
        fundingAmount,
        validationResult: 'amount required',
      });
      return NextResponse.json({ error: 'amount required' }, { status: 400 });
    }

    if (!currency?.trim()) {
      logPaymentEvents('validation failed', {
        dealId,
        organizationId,
        authenticatedUserId,
        incomingRequestBody: requestBody,
        fundingAmount,
        validationResult: 'currency required',
      });
      return NextResponse.json({ error: 'currency required' }, { status: 400 });
    }

    const sourceType = requestBody.sourceType === 'CSV_IMPORT' ? 'CSV_IMPORT' : 'MANUAL';
    const receivedAt = requestBody.receivedAt ? new Date(requestBody.receivedAt) : null;
    if (receivedAt && Number.isNaN(receivedAt.getTime())) {
      logPaymentEvents('validation failed', {
        dealId,
        organizationId,
        authenticatedUserId,
        incomingRequestBody: requestBody,
        fundingAmount,
        validationResult: 'invalid receivedAt',
      });
      return NextResponse.json({ error: 'invalid receivedAt' }, { status: 400 });
    }

    logPaymentEvents('validation passed (manual mode)', {
      dealId,
      organizationId,
      authenticatedUserId,
      incomingRequestBody: requestBody,
      fundingAmount: Number(amount),
      currency: currency.trim(),
      sourceType,
      receivedAt: receivedAt?.toISOString() ?? null,
      validationResult: 'ok',
    });

    logPaymentEvents('before createManualPilotDealPaymentEvent', {
      dealId,
      organizationId,
      authenticatedUserId,
      fundingAmount: Number(amount),
      prismaMutationsExpected: ['payment_events.create'],
    });

    const r = await createManualPilotDealPaymentEvent({
      userId: user.id,
      dealId,
      amount: Number(amount),
      currency: currency.trim(),
      sourceType,
      sourceReference: requestBody.sourceReference ?? null,
      rawPayloadJson: requestBody.rawPayloadJson,
      receivedAt: receivedAt ?? undefined,
    });

    logPaymentEvents('after createManualPilotDealPaymentEvent', {
      dealId,
      organizationId,
      authenticatedUserId,
      fundingAmount: Number(amount),
      ok: r.ok,
      error: r.ok ? null : r.error,
      paymentEventId: r.ok ? r.paymentEvent.id : null,
    });

    if (!r.ok) {
      logPaymentEvents('responding 404', {
        dealId,
        organizationId,
        authenticatedUserId,
        fundingAmount: Number(amount),
        reason: r.error,
      });
      return NextResponse.json({ error: r.error }, { status: 404 });
    }

    logPaymentEvents('before refreshDealNetworkPilotObligationsForUser', {
      dealId,
      organizationId,
      authenticatedUserId,
      fundingAmount: Number(amount),
      paymentEventId: r.paymentEvent.id,
      prismaMutationsExpected: [
        'deal_network_pilot_obligations.deleteMany (per deal)',
        'deal_network_pilot_obligations.createMany (per deal)',
      ],
    });

    await refreshDealNetworkPilotObligationsForUser(user.id);

    logPaymentEvents('after refreshDealNetworkPilotObligationsForUser', {
      dealId,
      organizationId,
      authenticatedUserId,
      fundingAmount: Number(amount),
      paymentEventId: r.paymentEvent.id,
    });

    logPaymentEvents('responding 200', {
      dealId,
      organizationId,
      authenticatedUserId,
      fundingAmount: Number(amount),
      paymentEventId: r.paymentEvent.id,
    });

    return respondWithFundingSync(user.id, dealId, { ok: true, paymentEvent: r.paymentEvent });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      logPaymentEventsError('responding 401', e, {
        dealId,
        organizationId,
        authenticatedUserId,
        incomingRequestBody: requestBody,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logPaymentEventsError('responding 500', e, {
      dealId,
      organizationId,
      authenticatedUserId,
      incomingRequestBody: requestBody,
      fundingAmount: requestBody?.amount ?? null,
    });

    return paymentEvents500Response(e);
  }
}
