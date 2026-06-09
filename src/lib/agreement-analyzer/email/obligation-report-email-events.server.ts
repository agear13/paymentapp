import 'server-only';

import type { ObligationReportEmailType } from '@prisma/client';

import { prisma } from '@/lib/server/prisma';

export async function createObligationReportEmailEvent(input: {
  leadId: string;
  emailType: ObligationReportEmailType;
  providerMessageId?: string | null;
}) {
  return prisma.obligation_report_email_events.create({
    data: {
      lead_id: input.leadId,
      email_type: input.emailType,
      provider_message_id: input.providerMessageId ?? null,
    },
  });
}

export async function findObligationReportEmailEventByProviderMessageId(
  providerMessageId: string
) {
  return prisma.obligation_report_email_events.findFirst({
    where: { provider_message_id: providerMessageId },
  });
}

export async function markObligationReportEmailDelivered(
  emailEventId: string,
  deliveredAt = new Date()
) {
  return prisma.obligation_report_email_events.update({
    where: { id: emailEventId },
    data: { delivered_at: deliveredAt },
  });
}

export async function markObligationReportEmailOpened(
  emailEventId: string,
  openedAt = new Date()
) {
  return prisma.obligation_report_email_events.update({
    where: { id: emailEventId },
    data: { opened_at: openedAt },
  });
}

export async function markObligationReportEmailClicked(
  emailEventId: string,
  clickedAt = new Date()
) {
  return prisma.obligation_report_email_events.update({
    where: { id: emailEventId },
    data: { clicked_at: clickedAt },
  });
}

export async function markObligationReportEmailBounced(
  emailEventId: string,
  bouncedAt = new Date()
) {
  return prisma.obligation_report_email_events.update({
    where: { id: emailEventId },
    data: { bounced_at: bouncedAt },
  });
}
