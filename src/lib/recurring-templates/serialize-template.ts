import type { RecurringTemplateInterval, RecurringTemplateStatus } from '@prisma/client';
import { prismaIntervalToApi, prismaStatusToApi } from '@/lib/recurring-templates/api-mappers';

export type RecurringTemplateDbRow = {
  id: string;
  organization_id: string;
  amount: { toString(): string };
  currency: string;
  description: string;
  customer_email: string | null;
  recurrence_interval: RecurringTemplateInterval;
  interval_count: number;
  next_run_at: Date;
  end_date: Date | null;
  status: RecurringTemplateStatus;
  due_days_after_invoice: number | null;
  last_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export function serializeRecurringTemplate(row: RecurringTemplateDbRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    amount: Number(row.amount),
    currency: row.currency,
    description: row.description,
    customerEmail: row.customer_email,
    interval: prismaIntervalToApi(row.recurrence_interval),
    intervalCount: row.interval_count,
    nextRunAt: row.next_run_at.toISOString(),
    endDate: row.end_date ? row.end_date.toISOString().slice(0, 10) : null,
    status: prismaStatusToApi(row.status),
    dueDaysAfterInvoice: row.due_days_after_invoice,
    lastRunAt: row.last_run_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
