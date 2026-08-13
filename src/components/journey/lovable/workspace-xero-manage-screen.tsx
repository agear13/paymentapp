'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { XeroIntegrationPanel } from '@/components/dashboard/settings/xero-integration-panel';
import { XeroOAuthSuccessBanner } from '@/components/xero/xero-oauth-success-banner';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { XERO_SETUP_PAGE, type MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { formatXeroOAuthError } from '@/lib/xero/xero-customer-messages';
import {
  clearXeroOAuthContinueFrom,
  readXeroOAuthContinueFrom,
} from '@/lib/xero/xero-oauth-continue-context';

type WorkspaceXeroManageScreenProps = {
  organizationId: string;
  merchantRails: MerchantPaymentRails;
  guidedSetupAssistant?: boolean;
};

function WorkspaceXeroManageContent({
  organizationId,
  merchantRails,
  guidedSetupAssistant,
  showOAuthSuccess,
  onDismissOAuthSuccess,
  onContinueOAuthSuccess,
}: WorkspaceXeroManageScreenProps & {
  showOAuthSuccess: boolean;
  onDismissOAuthSuccess: () => void;
  onContinueOAuthSuccess: () => void;
}) {
  return (
    <>
      {showOAuthSuccess ? (
        <XeroOAuthSuccessBanner
          variant="commercial"
          onContinue={onContinueOAuthSuccess}
          onDismiss={onDismissOAuthSuccess}
        />
      ) : null}

      <XeroIntegrationPanel
        organizationId={organizationId}
        stablecoinSettlementsEnabled={merchantRails.stablecoinSettlementsEnabled}
        merchantRails={merchantRails}
        returnTo={COMMERCIAL_OS_ROUTES.connectedXero}
        guidedSetup={!guidedSetupAssistant}
        guidedSetupAssistant={guidedSetupAssistant}
        commercialOs
      />
    </>
  );
}

export function WorkspaceXeroManageScreen({
  organizationId,
  merchantRails,
  guidedSetupAssistant = false,
}: WorkspaceXeroManageScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const readiness = useCommercialReadinessOptional();
  const [showOAuthSuccess, setShowOAuthSuccess] = useState(false);
  const [continueFromHref, setContinueFromHref] = useState<string | null>(null);

  useEffect(() => {
    setContinueFromHref(readXeroOAuthContinueFrom());
  }, []);

  useEffect(() => {
    const success = searchParams?.get('xero_success');
    const error = searchParams?.get('xero_error');
    const selectTenant = searchParams?.get('select_tenant');

    if (!success && !error) return;

    if (success === 'connected') {
      setShowOAuthSuccess(true);
      if (selectTenant === 'true') {
        toast.message('Multiple Xero organisations found', {
          description: 'Open Manage to select the correct organisation.',
        });
      }
      void readiness?.refresh();
      router.replace(COMMERCIAL_OS_ROUTES.connectedXero);
      return;
    }

    if (error) {
      const customer = formatXeroOAuthError(error);
      toast.error(customer.message, { description: customer.action });
      void readiness?.refresh();
      router.replace(COMMERCIAL_OS_ROUTES.connectedXero);
    }
  }, [searchParams, router, readiness]);

  const handleContinueOAuthSuccess = () => {
    setShowOAuthSuccess(false);
    const invoiceAccounts = document.getElementById('invoice-accounts') as HTMLDetailsElement | null;
    if (invoiceAccounts) {
      invoiceAccounts.open = true;
      invoiceAccounts.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleReturnToOrigin = () => {
    if (!continueFromHref) return;
    clearXeroOAuthContinueFrom();
    router.push(continueFromHref);
  };

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <Link
          href={COMMERCIAL_OS_ROUTES.connected}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Connected Systems
        </Link>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{XERO_SETUP_PAGE.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">{XERO_SETUP_PAGE.subtitle}</p>
      </header>

      <WorkspaceXeroManageContent
        organizationId={organizationId}
        merchantRails={merchantRails}
        guidedSetupAssistant={guidedSetupAssistant}
        showOAuthSuccess={showOAuthSuccess}
        onDismissOAuthSuccess={() => setShowOAuthSuccess(false)}
        onContinueOAuthSuccess={handleContinueOAuthSuccess}
      />

      {continueFromHref ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-[13px] text-ink-soft">
            When you are ready, you can return to where you started.
          </p>
          <button
            type="button"
            onClick={handleReturnToOrigin}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Continue where you left off
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
