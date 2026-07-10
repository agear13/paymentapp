'use client';

import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';

type WhatsChangedPanelProps = {
  auditEntries: OperationalAuditEntry[];
  currency?: string;
};

type ChangeDelta = {
  label: string;
  value: string;
};

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function entriesSince(entries: OperationalAuditEntry[], windowMs: number): OperationalAuditEntry[] {
  const cutoff = new Date(Date.now() - windowMs);
  return entries.filter((e) => {
    try {
      return new Date(e.timestamp) >= cutoff;
    } catch {
      return false;
    }
  });
}

function countType(
  entries: OperationalAuditEntry[],
  types: OperationalAuditEntry['type'][]
): number {
  return entries.filter((e) => types.includes(e.type)).length;
}

function deriveDeltas(
  recent: OperationalAuditEntry[],
  currency: string
): ChangeDelta[] {
  const deltas: ChangeDelta[] = [];

  const agreements = countType(recent, ['project_initialized', 'conversation_imported']);
  if (agreements > 0) deltas.push({ label: 'Projects created', value: `+${agreements}` });

  const approvals = countType(recent, ['agreement_approved']);
  if (approvals > 0) deltas.push({ label: 'Participants approved', value: `+${approvals}` });

  const fundingEvents = countType(recent, ['funding_linked', 'funding_reserved_against_obligations']);
  if (fundingEvents > 0) deltas.push({ label: 'Funding events', value: `+${fundingEvents}` });

  const payouts = countType(recent, ['payout_eligible', 'release_batch_generated']);
  if (payouts > 0) deltas.push({ label: 'Payout releases', value: `+${payouts}` });

  const providers = countType(recent, ['stripe_connected', 'payment_rails_connected']);
  if (providers > 0) deltas.push({ label: 'Providers connected', value: `+${providers}` });

  return deltas;
}

/** What changed in the last 24 hours — derived from audit timeline. */
export function WhatsChangedPanel({ auditEntries, currency = 'AUD' }: WhatsChangedPanelProps) {
  const recent = entriesSince(auditEntries, WINDOW_MS);
  if (recent.length === 0) return null;

  const deltas = deriveDeltas(recent, currency);
  if (deltas.length === 0) return null;

  return (
    <section aria-label="What changed since yesterday" className="space-y-2.5">
      <h2 className="text-sm font-semibold text-foreground">Since yesterday</h2>
      <div className="rounded-xl border border-border/50 bg-muted/10 px-4 py-3.5">
        <ul className="space-y-1.5">
          {deltas.map((d) => (
            <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-semibold text-[rgb(29,111,66)] tabular-nums">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
