'use client';

import { Megaphone } from 'lucide-react';
import { MarketingDashboardSection } from '@/components/marketing-labs/marketing-dashboard-section';
import { CompanyBrainSection } from '@/components/marketing-labs/company-brain-section';
import { CampaignsSection } from '@/components/marketing-labs/campaigns-section';
import { AiTeamReportsSection } from '@/components/marketing-labs/ai-team-reports-section';

export function MarketingPageClient() {
  return (
    <div className="space-y-16 pb-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Provvypay Labs Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Your client portal for the AI Marketing Team.
            </p>
          </div>
        </div>
      </div>

      <MarketingDashboardSection />
      <CompanyBrainSection />
      <CampaignsSection />
      <AiTeamReportsSection />
    </div>
  );
}
