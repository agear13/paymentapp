'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { XeroIntegrationPanel } from '@/components/dashboard/settings/xero-integration-panel';
import { XeroOAuthSuccessBanner } from '@/components/xero/xero-oauth-success-banner';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { CommercialOsXeroReadinessBanner } from '@/components/journey/lovable/commercial-os-xero-readiness-banner';

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
      <CommercialOsXeroReadinessBanner surface="xero-setup" />

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

  useEffect(() => {
    if (searchParams?.get('xero_success') === 'connected') {
      setShowOAuthSuccess(true);
      void readiness?.refresh();
      router.replace(COMMERCIAL_OS_ROUTES.connectedXero);
    }
  }, [searchParams, router, readiness]);

  const handleContinueOAuthSuccess = () => {
    setShowOAuthSuccess(false);
    const mappings = document.getElementById('advanced-accounting-settings') as HTMLDetailsElement | null;
    if (mappings) {
      mappings.open = true;
      mappings.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Set up Xero</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Connect Xero and choose which accounts Provvy should use. Setup status on this page shows
          what is required and what is optional.
        </p>
      </header>

      <WorkspaceXeroManageContent
        organizationId={organizationId}
        merchantRails={merchantRails}
        guidedSetupAssistant={guidedSetupAssistant}
        showOAuthSuccess={showOAuthSuccess}
        onDismissOAuthSuccess={() => setShowOAuthSuccess(false)}
        onContinueOAuthSuccess={handleContinueOAuthSuccess}
      />
    </div>
  );
}
