'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SERVICE_CATALOG_ATTRIBUTION_WARNING } from '@/lib/operations/merchant-operational-copy';

type ServiceCatalogGuidanceProps = {
  organizationId?: string | null;
  /** When true, show warning if catalog is empty */
  attributionEnabled?: boolean;
  className?: string;
};

type ServiceRow = { id: string; name: string };

export function ServiceCatalogGuidance({
  organizationId,
  attributionEnabled = false,
  className,
}: ServiceCatalogGuidanceProps) {
  const [services, setServices] = React.useState<ServiceRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!attributionEnabled || !organizationId) {
      setServices([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch(
      `/api/organization-services?organizationId=${encodeURIComponent(organizationId)}&status=active`
    )
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: ServiceRow[] }) => {
        if (!cancelled) setServices(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attributionEnabled, organizationId]);

  if (!attributionEnabled || loading || services === null || services.length > 0) {
    return null;
  }

  return (
    <Alert
      variant="default"
      className={className ?? 'border-amber-500/25 bg-amber-500/5'}
    >
      <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-300">
        {SERVICE_CATALOG_ATTRIBUTION_WARNING.title}
      </AlertTitle>
      <AlertDescription className="text-amber-800/90 dark:text-amber-400/90 space-y-2">
        <p>{SERVICE_CATALOG_ATTRIBUTION_WARNING.description}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/services">
            {SERVICE_CATALOG_ATTRIBUTION_WARNING.cta}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
