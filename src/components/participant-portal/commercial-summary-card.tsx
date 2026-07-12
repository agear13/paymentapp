'use client';

import type { PortalCommercialSection } from '@/lib/participant-portal/participant-portal-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  sections: PortalCommercialSection[];
  emptyMessage?: string;
};

function FixedFeeSection({
  section,
}: {
  section: Extract<PortalCommercialSection, { kind: 'fixed_fee' }>;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fixed Fee</p>
      <p className="text-2xl font-semibold tabular-nums">{section.amount}</p>
      {section.dueDateLabel ? (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Due</p>
          <p className="text-sm font-medium">{section.dueDateLabel}</p>
        </div>
      ) : null}
    </div>
  );
}

function RevenueShareSection({
  section,
}: {
  section: Extract<PortalCommercialSection, { kind: 'revenue_share' }>;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revenue Share</p>
      <p className="text-2xl font-semibold">{section.percentage}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue Source</p>
          <p className="text-sm font-medium">{section.revenueSource}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Settlement</p>
          <p className="text-sm font-medium">{section.settlement}</p>
        </div>
      </div>
    </div>
  );
}

function CommissionSection({
  section,
}: {
  section: Extract<PortalCommercialSection, { kind: 'commission' }>;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commission</p>
      <p className="text-2xl font-semibold">{section.percentage}</p>
      {section.attributionType !== 'none' ? (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Attribution</p>
          <p className="text-sm font-medium">
            {section.attributionType === 'promo_code' ? 'Promo Code' : 'Referral Link'}
          </p>
          <p className="text-sm text-primary font-mono mt-0.5 break-all">{section.attributionValue}</p>
        </div>
      ) : null}
    </div>
  );
}

function MilestoneSection({
  section,
}: {
  section: Extract<PortalCommercialSection, { kind: 'milestone' }>;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Milestone</p>
      <p className="text-sm font-medium">{section.label}</p>
      {section.amount ? <p className="text-lg font-semibold tabular-nums">{section.amount}</p> : null}
      {section.trigger ? (
        <p className="text-xs text-muted-foreground">{section.trigger}</p>
      ) : null}
    </div>
  );
}

function CustomSection({
  section,
}: {
  section: Extract<PortalCommercialSection, { kind: 'custom' }>;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.label}</p>
      <p className="text-sm">{section.detail}</p>
    </div>
  );
}

export function CommercialSummaryCard({ sections, emptyMessage }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Commercial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {emptyMessage ?? 'Commercial terms will appear once configured by the organiser.'}
            </p>
          </div>
        ) : (
          sections.map((section, index) => {
            const key = `${section.kind}-${index}`;
            switch (section.kind) {
              case 'fixed_fee':
                return <FixedFeeSection key={key} section={section} />;
              case 'revenue_share':
                return <RevenueShareSection key={key} section={section} />;
              case 'commission':
                return <CommissionSection key={key} section={section} />;
              case 'milestone':
                return <MilestoneSection key={key} section={section} />;
              case 'custom':
                return <CustomSection key={key} section={section} />;
            }
          })
        )}
      </CardContent>
    </Card>
  );
}
