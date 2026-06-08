'use client';

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EntitlementFeature } from '@/lib/entitlements/types';
import { STARTER_MAX_AGREEMENTS, STARTER_MAX_AI_IMPORTS } from '@/lib/entitlements/plans';
import { useEntitlements } from '@/hooks/use-entitlements';

const LIMIT_MESSAGES: Partial<Record<EntitlementFeature, string>> = {
  create_agreement:
    'Starter includes 3 active agreements. Upgrade to Professional for unlimited agreements.',
  ai_import:
    'Starter includes 3 AI imports. Upgrade to Professional for unlimited imports.',
};

type StarterLimitAlertProps = {
  feature: 'create_agreement' | 'ai_import';
  className?: string;
};

export function StarterLimitAlert({ feature, className }: StarterLimitAlertProps) {
  const { loading, isAllowed, plan, usage, pilotBypass } = useEntitlements();

  if (loading || pilotBypass || plan !== 'starter' || isAllowed(feature)) {
    return null;
  }

  const limit = feature === 'create_agreement' ? STARTER_MAX_AGREEMENTS : STARTER_MAX_AI_IMPORTS;
  const current =
    feature === 'create_agreement' ? usage?.agreementCount : usage?.aiImportCount;
  const message = LIMIT_MESSAGES[feature];

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {message}
        {current != null ? (
          <span className="block mt-1 text-xs opacity-90">
            {current}/{limit} used on Starter
          </span>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
