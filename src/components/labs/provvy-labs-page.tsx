'use client';

import '@/components/journey/lovable/lovable-journey.css';
import { LabsNav } from '@/components/labs/labs-nav';
import { LabsHero } from '@/components/labs/labs-hero';
import { LabsModel } from '@/components/labs/labs-model';
import { LabsCompanyBrain } from '@/components/labs/labs-company-brain';
import { LabsDifferentiation } from '@/components/labs/labs-differentiation';
import { LabsAiMarketingTeam } from '@/components/labs/labs-ai-marketing-team';
import { LabsCampaignOutputs } from '@/components/labs/labs-campaign-outputs';
import { LabsCampaignReport } from '@/components/labs/labs-campaign-report';
import { LabsMoreTeams } from '@/components/labs/labs-more-teams';
import { LabsTeamsWorkflows } from '@/components/labs/labs-teams-workflows';
import { LabsHowItWorks } from '@/components/labs/labs-how-it-works';
import { LabsFinalCta } from '@/components/labs/labs-final-cta';
import { LabsFooter } from '@/components/labs/labs-footer';
import { useLabsTheme } from '@/components/labs/labs-theme';

export function ProvvyLabsPage() {
  const { dark, toggle } = useLabsTheme();

  return (
    <div
      className={`lovable-journey min-h-screen overflow-x-hidden bg-background text-foreground antialiased ${dark ? 'dark' : ''}`}
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="relative">
        <LabsNav dark={dark} onToggleDark={toggle} />
        <LabsHero />
        <LabsModel />
        <LabsCompanyBrain />
        <LabsDifferentiation />
        <LabsAiMarketingTeam />
        <LabsCampaignOutputs />
        <LabsCampaignReport />
        <LabsMoreTeams />
        <LabsTeamsWorkflows />
        <LabsHowItWorks />
        <LabsFinalCta />
        <LabsFooter />
      </div>
    </div>
  );
}
