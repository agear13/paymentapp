'use client';

import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import {
  computeXeroSetupSteps,
  xeroSetupProgressPercent,
  type XeroSetupStep,
} from '@/lib/xero/xero-setup-guidance';

type XeroSetupProgressProps = {
  organizationId: string;
  variant?: 'default' | 'commercial';
};

type SetupData = {
  connected: boolean;
  tenantId?: string | null;
  revenueMapped: boolean;
  receivableMapped: boolean;
  pendingPaymentCount: number;
};

export function XeroSetupProgress({
  organizationId,
  variant = 'default',
}: XeroSetupProgressProps) {
  const [steps, setSteps] = useState<XeroSetupStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [statusRes, mappingsRes, queueRes] = await Promise.all([
          fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/settings/xero-mappings?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetch(
            `/api/xero/sync/stats?organization_id=${encodeURIComponent(organizationId)}`,
            { cache: 'no-store' }
          ),
        ]);

        const status = statusRes.ok
          ? ((await statusRes.json()) as { connected?: boolean; tenantId?: string })
          : { connected: false };
        const mappingsPayload = mappingsRes.ok
          ? ((await mappingsRes.json()) as {
              data?: {
                xero_revenue_account_id?: string | null;
                xero_receivable_account_id?: string | null;
              } | null;
            })
          : { data: null };
        const queuePayload = queueRes.ok
          ? ((await queueRes.json()) as { pendingCount?: number })
          : { pendingCount: 0 };

        const data: SetupData = {
          connected: Boolean(status.connected),
          tenantId: status.tenantId,
          revenueMapped: Boolean(mappingsPayload.data?.xero_revenue_account_id?.trim()),
          receivableMapped: Boolean(mappingsPayload.data?.xero_receivable_account_id?.trim()),
          pendingPaymentCount: queuePayload.pendingCount ?? 0,
        };

        if (!cancelled) {
          setSteps(computeXeroSetupSteps(data));
        }
      } catch {
        if (!cancelled) {
          setSteps(
            computeXeroSetupSteps({
              connected: false,
              revenueMapped: false,
              receivableMapped: false,
              pendingPaymentCount: 0,
            })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const percent = xeroSetupProgressPercent(steps);
  const isCommercial = variant === 'commercial';

  if (loading) {
    return (
      <div
        className={
          isCommercial
            ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
            : 'rounded-lg border bg-card p-4'
        }
      >
        <p className="text-sm text-muted-foreground">Loading setup progress…</p>
      </div>
    );
  }

  return (
    <div
      className={
        isCommercial
          ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
          : 'rounded-lg border bg-card p-5'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={
              isCommercial
                ? 'text-[15px] font-semibold text-foreground'
                : 'text-sm font-semibold'
            }
          >
            Xero Setup
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Progress: {percent}% complete
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2.5 text-sm">
            {step.complete ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
            )}
            <span className={step.complete ? 'text-foreground' : 'text-muted-foreground'}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
