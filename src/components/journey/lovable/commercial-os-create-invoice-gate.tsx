'use client';

import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type CommercialOsCreateInvoiceBlockedProps = {
  className?: string;
  compact?: boolean;
};

export function CommercialOsCreateInvoiceBlocked({
  className = '',
  compact = false,
}: CommercialOsCreateInvoiceBlockedProps) {
  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 ${className}`}
      role="status"
    >
      <p className={`font-semibold text-foreground ${compact ? 'text-[14px]' : 'text-[15px]'}`}>
        Finish your Xero setup before creating invoices.
      </p>
      <p className={`mt-1.5 text-ink-soft ${compact ? 'text-[12.5px]' : 'text-[13.5px]'}`}>
        Choose which Xero accounts Provvy should use, then you can send invoices that sync
        automatically.
      </p>
      <Link
        href={COMMERCIAL_OS_ROUTES.connectedXero}
        className={`mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 ${
          compact ? 'text-[12.5px]' : 'text-[13px]'
        }`}
      >
        Continue Xero setup
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ReadinessGateLoading({ fullPage }: { fullPage: boolean }) {
  if (fullPage) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center pb-24">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" aria-label="Loading readiness" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-ink-soft" aria-label="Loading readiness" />
    </div>
  );
}

type CommercialOsCreateInvoiceGateProps = {
  children: React.ReactNode;
  /** When true, show a centered full-page blocker instead of inline content. */
  fullPage?: boolean;
};

export function CommercialOsCreateInvoiceGate({
  children,
  fullPage = false,
}: CommercialOsCreateInvoiceGateProps) {
  const readiness = useCommercialReadinessOptional();

  if (!readiness || readiness.loading) {
    return <ReadinessGateLoading fullPage={fullPage} />;
  }

  if (!readiness.canCreateInvoice) {
    if (fullPage) {
      return (
        <div className="animate-fade-up mx-auto max-w-lg space-y-6 pb-24 pt-8">
          <CommercialOsCreateInvoiceBlocked />
          <Link
            href={COMMERCIAL_OS_ROUTES.receivables}
            className="inline-flex text-[13px] text-ink-soft hover:text-foreground"
          >
            ← Back to Receivables
          </Link>
        </div>
      );
    }
    return <CommercialOsCreateInvoiceBlocked />;
  }

  return <>{children}</>;
}

type CommercialOsCreateInvoiceLinkProps = {
  href?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

/** Renders a create-invoice link when ready; otherwise routes to Xero setup. */
export function CommercialOsCreateInvoiceLink({
  href = COMMERCIAL_OS_ROUTES.createInvoice,
  className,
  children,
  onClick,
}: CommercialOsCreateInvoiceLinkProps) {
  const readiness = useCommercialReadinessOptional();
  const waiting = !readiness || readiness.loading;
  const blocked = Boolean(readiness && !readiness.loading && !readiness.canCreateInvoice);
  const target = blocked ? COMMERCIAL_OS_ROUTES.connectedXero : href;

  if (waiting) {
    return (
      <span
        className={`inline-flex items-center gap-2 opacity-60 ${className ?? ''}`}
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {children}
      </span>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          if (blocked) {
            window.location.href = COMMERCIAL_OS_ROUTES.connectedXero;
            return;
          }
          onClick();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={target} className={className} aria-disabled={blocked}>
      {children}
    </Link>
  );
}
