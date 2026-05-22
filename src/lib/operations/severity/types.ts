export const OPERATIONAL_SEVERITIES = [
  'CRITICAL',
  'ACTION_REQUIRED',
  'WARNING',
  'INFORMATIONAL',
] as const;

export type OperationalSeverity = (typeof OPERATIONAL_SEVERITIES)[number];

export type AttentionItem = {
  id: string;
  severity: OperationalSeverity;
  title: string;
  explanation: string;
  projectName?: string;
  ctaLabel?: string;
  ctaHref?: string;
  confidenceImpact?: string;
  whyBlocked?: string;
  whatUnlocks?: string;
  recommendedStep?: string;
};
