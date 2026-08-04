'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { XeroIntegrationPanel } from '@/components/dashboard/settings/xero-integration-panel';
import { XeroOAuthSuccessBanner } from '@/components/xero/xero-oauth-success-banner';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

type WorkspaceXeroManageScreenProps = {
  organizationId: string;
  merchantRails: MerchantPaymentRails;
  guidedSetupAssistant?: boolean;
};

export function WorkspaceXeroManageScreen({
  organizationId,
  merchantRails,
  guidedSetupAssistant = false,
}: WorkspaceXeroManageScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOAuthSuccess, setShowOAuthSuccess] = useState(false);

  useEffect(() => {
    if (searchParams?.get('xero_success') === 'connected') {
      setShowOAuthSuccess(true);
      router.replace(COMMERCIAL_OS_ROUTES.connectedXero);
    }
  }, [searchParams, router]);

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
          Provvy will guide you through connecting Xero and making sure invoices and payments land
          in the right accounts. This usually takes about a minute.
        </p>
      </header>

      {showOAuthSuccess ? (
        <XeroOAuthSuccessBanner
          variant="commercial"
          onContinue={() => {
            setShowOAuthSuccess(false);
            const mappings = document.getElementById('advanced-accounting-settings') as HTMLDetailsElement | null;
            if (mappings) {
              mappings.open = true;
              mappings.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          onDismiss={() => setShowOAuthSuccess(false)}
        />
      ) : null}

      <XeroIntegrationPanel
        organizationId={organizationId}
        stablecoinSettlementsEnabled={merchantRails.stablecoinSettlementsEnabled}
        merchantRails={merchantRails}
        returnTo={COMMERCIAL_OS_ROUTES.connectedXero}
        guidedSetup={!guidedSetupAssistant}
        guidedSetupAssistant={guidedSetupAssistant}
      />
    </div>
  );
}
