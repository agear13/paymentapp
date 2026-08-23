'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Building2,
  CreditCard,
  Landmark,
  Percent,
  ShieldCheck,
} from 'lucide-react';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import { AccountingIntegrationNotice } from '@/components/journey/lovable/accounting-integration-notice';
import {
  PaymentsSectionCard,
  PaymentsProviderStatusBadge,
  StripeConnectSetupStatusBadge,
} from '@/components/journey/lovable/payments-settlement-ui';
import {
  PaymentsSettlementCommercialReadiness,
  PaymentsSettlementProgressCard,
} from '@/components/journey/lovable/payments-settlement-progress-card';
import { usePaymentsSettlementReadiness } from '@/hooks/use-payments-settlement-readiness';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { ACCOUNTING_PROVIDER_OPTIONS } from '@/lib/accounting/accounting-integration-copy';

export function WorkspacePaymentsSettlementScreen() {
  const searchParams = useSearchParams();
  const fromInvoice = searchParams?.get('from') === 'invoice';
  const requestedMethod = searchParams?.get('method') ?? 'Manual Bank Transfer';
  const returnHref = fromInvoice ? COMMERCIAL_OS_ROUTES.createInvoice : undefined;

  const { activation } = useWorkspaceActivation();
  const { loading, readiness, railSetup, manualBankConfigured, refresh } =
    usePaymentsSettlementReadiness();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const enabledCheckoutRails = railSetup
    ? [
        railSetup.multiRails.stripe?.configured,
        railSetup.multiRails.hedera?.configured,
        railSetup.multiRails.evm_wallet?.configured,
        railSetup.multiRails.wise?.configured,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="animate-fade-up space-y-6 pb-20">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <CreditCard className="h-3 w-3" />
          Settings
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Payments &amp; Settlement
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Configure payment providers and settlement settings for customer collections. Payment
          provider account IDs are entered manually — there is no OAuth connect flow for Stripe on
          this page.
        </p>
      </header>

      {fromInvoice ? (
        <CommercialOsNextStepBanner
          tone="default"
          title={`Finish configuring ${requestedMethod}`}
          message={
            <>
              Save the sections below and return to your invoice when ready.{' '}
              <Link href={COMMERCIAL_OS_ROUTES.createInvoice} className="font-medium underline">
                Return to invoice
              </Link>
            </>
          }
        />
      ) : null}

      <PaymentsSettlementProgressCard />

      <PaymentsSectionCard
        id="branding"
        icon={Building2}
        title="Branding"
        description="These details appear on your invoices, payment pages and customer receipts. Saved separately from payment providers."
      >
        <MerchantSettingsForm
          sections={['branding']}
          presentation="commercial-os"
          onSaved={refresh}
        />
      </PaymentsSectionCard>

      <PaymentsSectionCard
        id="payment-providers"
        icon={CreditCard}
        title="Payment Providers"
        description="Paste provider account IDs to enable checkout rails. Each section has its own save button — saving branding does not save payment providers."
        aside={
          railSetup ? (
            <StripeConnectSetupStatusBadge
              status={
                railSetup.multiRails.stripe?.configured ? 'connected' : 'setup_required'
              }
            />
          ) : null
        }
      >
        <div className="mb-4 space-y-3">
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[12.5px] text-ink-soft">
            Manual bank transfer details are saved from your most recent invoice with bank instructions.
            Configure bank fields when creating an invoice, or update them on an existing invoice with
            manual bank payment method.
          </div>
          <div className="text-[12px] text-ink-soft">
            {enabledCheckoutRails} of 4 checkout rails enabled
            {manualBankConfigured ? ' · manual bank ready' : ''}
          </div>
        </div>
        <MerchantSettingsForm
          sections={['providers']}
          presentation="commercial-os"
          onSaved={refresh}
        />
      </PaymentsSectionCard>

      <PaymentsSectionCard
        icon={Percent}
        title="Settlement"
        description="Configure how incoming payments are allocated and released into your accounts."
      >
        <div className="space-y-4 text-[13px] text-ink-soft">
          <p>
            Settlement rules are managed through your commercial workflows and payout configuration.
            Provvy releases participant payouts when agreements, earnings and payment collection are
            complete.
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Payout readiness
              </dt>
              <dd className="mt-1 text-[14px] font-medium text-foreground">
                {activation?.releaseEligible ? 'Ready for release' : 'Setup in progress'}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Payout method
              </dt>
              <dd className="mt-1 text-[14px] font-medium text-foreground">
                {activation?.payoutMethodConfigured ? 'Configured' : 'Not configured'}
              </dd>
            </div>
          </dl>
          <Link
            href={COMMERCIAL_OS_ROUTES.workflowReconciliation}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium transition-colors hover:bg-secondary"
          >
            Open workflow reconciliation
          </Link>
        </div>
      </PaymentsSectionCard>

      <PaymentsSectionCard
        icon={ShieldCheck}
        title="Participant Earnings"
        description="Configure default payout behaviour for the people and partners who share in revenue."
      >
        <div className="space-y-4 text-[13px] text-ink-soft">
          <p>
            Participant compensation is defined per agreement and workflow. Configure earnings structures,
            approval rules, and release timing in your project workflows.
          </p>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Status
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium text-foreground">
                {activation?.participantsConfigured
                  ? `${activation.participantsConfiguredCount} participant(s) configured`
                  : 'Earnings not yet configured'}
              </span>
              <PaymentsProviderStatusBadge
                connected={Boolean(activation?.participantsConfigured)}
                label="Not configured"
              />
            </div>
          </div>
          <Link
            href={COMMERCIAL_OS_ROUTES.workflows}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium transition-colors hover:bg-secondary"
          >
            Manage workflows
          </Link>
        </div>
      </PaymentsSectionCard>

      <PaymentsSectionCard
        icon={BookOpen}
        title="Accounting"
        description="Automatically push invoices, bills and payments to your accounting software."
        aside={
          readiness.checklist.find((c) => c.id === 'accounting')?.done ? (
            <PaymentsProviderStatusBadge connected label="Connected" />
          ) : (
            <PaymentsProviderStatusBadge connected={false} label="Not connected" />
          )
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {ACCOUNTING_PROVIDER_OPTIONS.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-card text-[11px] font-semibold shadow-soft">
                  {provider.name.slice(0, 2)}
                </div>
                <div>
                  <div className="text-[13px] font-medium">{provider.name}</div>
                  {!provider.available ? (
                    <div className="text-[11px] text-ink-soft">Coming soon</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <AccountingIntegrationNotice returnTo={COMMERCIAL_OS_ROUTES.payments} />
        </div>
      </PaymentsSectionCard>

      {!loading ? (
        <div className="flex justify-end">
          <Link
            href={COMMERCIAL_OS_ROUTES.treasury}
            className="text-[13px] font-medium text-accent-foreground underline"
          >
            Treasury activity & reconciliation →
          </Link>
        </div>
      ) : null}

      {!loading ? (
        <PaymentsSettlementCommercialReadiness
          checklist={readiness.checklist}
          doneCount={readiness.doneCount}
          requiredDone={readiness.requiredDone}
          returnHref={returnHref}
        />
      ) : null}
    </div>
  );
}
