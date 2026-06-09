import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/server/prisma';

export type CreateDemoBookingInput = {
  leadId: string;
  reportId: string;
  calendlyEventId: string;
  inviteeName: string;
  inviteeEmail: string;
  meetingTime: Date;
  bookingSource: string;
  trackingToken: string;
};

export async function createDemoBooking(input: CreateDemoBookingInput) {
  return prisma.agreement_analyzer_demo_bookings.create({
    data: {
      lead_id: input.leadId,
      report_id: input.reportId,
      calendly_event_id: input.calendlyEventId,
      invitee_name: input.inviteeName,
      invitee_email: input.inviteeEmail,
      meeting_time: input.meetingTime,
      booking_source: input.bookingSource,
      tracking_token: input.trackingToken,
    },
  });
}

export async function findDemoBookingByCalendlyEventId(calendlyEventId: string) {
  return prisma.agreement_analyzer_demo_bookings.findUnique({
    where: { calendly_event_id: calendlyEventId },
  });
}

export async function findDemoBookingsByLeadId(leadId: string) {
  return prisma.agreement_analyzer_demo_bookings.findMany({
    where: { lead_id: leadId },
    orderBy: { meeting_time: 'desc' },
  });
}

export async function countDemoBookings(where?: Prisma.agreement_analyzer_demo_bookingsWhereInput) {
  return prisma.agreement_analyzer_demo_bookings.count({ where });
}
