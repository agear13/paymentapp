import { Prisma } from '@prisma/client';
import { CreatePaymentLinkSchema } from '@/lib/validations/schemas';
import { insertPaymentLinkInTransaction } from '@/lib/payment-links/create-payment-link-in-tx';
import { runPaymentLinkPostCreateEffects } from '@/lib/payment-links/payment-link-post-create';
import { prisma } from '@/lib/server/prisma';
import { generateUniqueShortCode } from '@/lib/server/short-code';
import { loggers } from '@/lib/logger';
import { computeNextRunAt, nextRunExceedsEndDate } from '@/lib/recurring-templates/compute-next-run-at';

function isSerializationRetryError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

type TxIdle = { kind: 'idle' };
type TxOk = {
  kind: 'ok';
  paymentLinkId: string;
  shortCode: string;
  organizationId: string;
  invoiceCurrency: string;
  invoiceReference: string | null;
  recurringTemplateId: string;
};

type TxResult = TxIdle | TxOk;

async function processOneDueTemplate(shortCode: string): Promise<TxResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const pick = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM recurring_templates
            WHERE status = 'ACTIVE'
              AND next_run_at <= NOW()
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
            ORDER BY next_run_at ASC, id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `;
          if (pick.length === 0) {
            return { kind: 'idle' };
          }

          const template = await tx.recurring_templates.findUniqueOrThrow({
            where: { id: pick[0].id },
          });

          if (
            template.status !== 'ACTIVE' ||
            template.next_run_at > new Date()
          ) {
            return { kind: 'idle' };
          }

          const now = new Date();
          const currency = template.currency.trim().toUpperCase();
          let dueDateIso: string | undefined;
          if (
            template.due_days_after_invoice != null &&
            template.due_days_after_invoice >= 0
          ) {
            const due = new Date(now.getTime());
            due.setUTCDate(due.getUTCDate() + template.due_days_after_invoice);
            dueDateIso = due.toISOString();
          }

          const validatedData = CreatePaymentLinkSchema.parse({
            organizationId: template.organization_id,
            amount: Number(template.amount),
            currency,
            invoiceCurrency: currency,
            description: template.description,
            customerEmail: template.customer_email ?? undefined,
            invoiceOnlyMode: true,
            dueDate: dueDateIso,
          });

          const link = await insertPaymentLinkInTransaction(tx, {
            organizationId: template.organization_id,
            shortCode,
            actorUserId: null,
            validatedData,
            invoiceOnly: true,
            resolvedPaymentMethod: null,
            effectiveInvoiceCurrency: currency,
            requestedInvoiceReference: null,
            wiseContext: null,
            pilotDealIdToStore: null,
          });

          const anchor = template.next_run_at;
          const nextRun = computeNextRunAt(
            anchor,
            template.recurrence_interval,
            template.interval_count
          );
          const pauseAfterSchedule =
            template.end_date != null && nextRunExceedsEndDate(nextRun, template.end_date);

          await tx.recurring_templates.update({
            where: { id: template.id },
            data: {
              next_run_at: nextRun,
              last_run_at: now,
              status: pauseAfterSchedule ? 'PAUSED' : 'ACTIVE',
            },
          });

          return {
            kind: 'ok',
            paymentLinkId: link.id,
            shortCode: link.short_code,
            organizationId: template.organization_id,
            invoiceCurrency: currency,
            invoiceReference: link.invoice_reference,
            recurringTemplateId: template.id,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 25_000,
        }
      );
    } catch (error) {
      if (isSerializationRetryError(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('recurring template transaction exhausted retries');
}

/**
 * Claims due templates with `FOR UPDATE SKIP LOCKED`, creates one payment link per iteration,
 * advances `next_run_at` in the same transaction (idempotent per run: double execution does not double-create).
 */
export async function runRecurringTemplatesJob(): Promise<{
  generated: number;
  iterations: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generated = 0;
  let iterations = 0;
  const maxIterations = 100;

  while (iterations < maxIterations) {
    iterations += 1;
    const shortCode = await generateUniqueShortCode();
    try {
      const result = await processOneDueTemplate(shortCode);
      if (result.kind === 'idle') {
        break;
      }
      loggers.payment.info(
        {
          recurringTemplateId: result.recurringTemplateId,
          paymentLinkId: result.paymentLinkId,
          invoiceReference: result.invoiceReference,
          organizationId: result.organizationId,
          shortCode: result.shortCode,
        },
        'Recurring invoice generated from template'
      );
      try {
        await runPaymentLinkPostCreateEffects({
          paymentLinkId: result.paymentLinkId,
          organizationId: result.organizationId,
          invoiceCurrency: result.invoiceCurrency,
          shortCode: result.shortCode,
        });
      } catch (postErr: unknown) {
        const message = postErr instanceof Error ? postErr.message : String(postErr);
        errors.push(`post-create:${message}`);
        loggers.payment.error(
          { err: postErr, paymentLinkId: result.paymentLinkId },
          'Recurring invoice post-create (FX/QR/Xero queue) failed; link exists and will sync on normal paths'
        );
      }
      generated += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      loggers.payment.error(
        { err, iteration: iterations },
        'Recurring template run failed; will retry on a later cycle if template was not advanced'
      );
      break;
    }
  }

  return { generated, iterations, errors };
}
