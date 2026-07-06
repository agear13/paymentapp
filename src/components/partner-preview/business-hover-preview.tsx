'use client';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { RiskScoreIndicator } from '@/components/partner-preview/risk-score-indicator';
import type { ClientBusiness } from '@/lib/data/mock-partner-preview';

interface BusinessHoverPreviewProps {
  business: ClientBusiness;
  children: React.ReactNode;
}

export function BusinessHoverPreview({ business, children }: BusinessHoverPreviewProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <div className="flex gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${business.logoColor}`}
          >
            {business.logoInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{business.name}</p>
            <p className="text-xs text-muted-foreground">{business.industry}</p>
          </div>
          <RiskScoreIndicator
            score={business.riskScore}
            label={business.riskLabel}
            size="sm"
            showLabel={false}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Revenue</p>
            <p className="font-medium">
              ${business.revenueSummary.monthlyRevenue.toLocaleString()}/mo
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last payment</p>
            <p className="font-medium">
              {business.lastPayment.amount > 0
                ? `$${business.lastPayment.amount.toLocaleString()}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Accounting</p>
            <p className="font-medium">{business.accountingPlatform}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Connection</p>
            <p className="font-medium">{business.accountingConnectionStatus}</p>
          </div>
        </div>
        <p className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">AI: </span>
          {business.aiSummary}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
