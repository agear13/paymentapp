'use client';

import { MapPin } from 'lucide-react';
import type { CopilotEntityContext, CopilotScreenContext } from '@/lib/copilot/copilot-types';
import { cn } from '@/lib/utils';

const SCREEN_LABELS: Record<CopilotScreenContext, string> = {
  payment_links: 'Invoices',
  payment_link_detail: 'Invoice detail',
  deal_network: 'Deal network',
  deal_detail: 'Deal detail',
  merchant_settings: 'Merchant settings',
  unknown: 'Workspace',
};

function entityLine(entity: CopilotEntityContext) {
  if (!entity?.label && !entity?.type) return null;
  const parts = [entity.type, entity.label, entity.id ? `#${entity.id}` : null].filter(Boolean);
  return parts.join(' · ');
}

export function CopilotContextBar({
  screen,
  entity,
  className,
}: {
  screen: CopilotScreenContext;
  entity: CopilotEntityContext;
  className?: string;
}) {
  const sub = entityLine(entity);

  return (
    <div
      className={cn(
        'border-b bg-muted/30 px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-xs leading-snug">
          <p className="font-medium text-foreground">{SCREEN_LABELS[screen]}</p>
          {sub ? <p className="text-muted-foreground mt-0.5 truncate">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}
