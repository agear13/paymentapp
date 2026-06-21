export type MarketingLoadingContext =
  | 'company-brain'
  | 'ai-marketing-team'
  | 'campaign-package'
  | 'creative-dispatch'
  | 'creative-production'
  | 'marketing-operations'
  | 'reports'
  | 'campaign-insights'
  | 'publishing';

const LOADING_COPY: Record<MarketingLoadingContext, string> = {
  'company-brain': 'Analysing your Company Brain…',
  'ai-marketing-team': 'Assigning AI Marketing Team specialists…',
  'campaign-package': 'Preparing Campaign Package…',
  'creative-dispatch': 'Packaging creative files for the AI Creative Team…',
  'creative-production': 'AI Creative Team preparing Creative Assets…',
  'marketing-operations': 'Preparing Marketing Operations…',
  reports: 'Preparing Client Report and AI Team Performance Report…',
  'campaign-insights': 'Calculating AI projections for this campaign…',
  publishing: 'Building publication schedule recommendations…',
};

export function getMarketingLoadingCopy(context: MarketingLoadingContext): string {
  return LOADING_COPY[context];
}
