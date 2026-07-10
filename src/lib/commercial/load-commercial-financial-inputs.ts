import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type {
  ProjectFundingSourceDto,
  ProjectTreasurySummary,
} from '@/lib/projects/funding-sources/types';

export type CommercialFinancialInputs = {
  treasury: ProjectTreasurySummary | null;
  fundingSources: ProjectFundingSourceDto[];
  obligationRows: BriefingObligationRowInput[];
};

/**
 * Loads the authoritative commercial inputs for a single agreement.
 * Used by both the workspace dashboard and agreement overview surfaces.
 */
export async function loadCommercialFinancialInputs(
  projectId: string,
  dealId: string
): Promise<CommercialFinancialInputs> {
  const [treRes, oblRes, fsRes] = await Promise.all([
    fetch(`/api/projects/${encodeURIComponent(projectId)}/treasury-summary`, {
      credentials: 'include',
      cache: 'no-store',
    }),
    fetch(`/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(dealId)}`, {
      credentials: 'include',
      cache: 'no-store',
    }),
    fetch(`/api/projects/${encodeURIComponent(projectId)}/funding-sources`, {
      credentials: 'include',
      cache: 'no-store',
    }),
  ]);

  let treasury: ProjectTreasurySummary | null = null;
  let obligationRows: BriefingObligationRowInput[] = [];
  let fundingSources: ProjectFundingSourceDto[] = [];

  if (treRes.ok) {
    const json = (await treRes.json()) as { data?: ProjectTreasurySummary };
    treasury = json.data ?? null;
  }

  if (oblRes.ok) {
    const json = (await oblRes.json()) as { data?: BriefingObligationRowInput[] };
    obligationRows = Array.isArray(json.data)
      ? json.data.filter((row) => row.deal_id === dealId)
      : [];
  }

  if (fsRes.ok) {
    const json = (await fsRes.json()) as { data?: ProjectFundingSourceDto[] };
    fundingSources = Array.isArray(json.data) ? json.data : [];
  }

  return { treasury, fundingSources, obligationRows };
}
