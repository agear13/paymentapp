import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { CommercialForecastingInput } from '@/lib/commercial-forecasting/types';
import type { WorkspaceTimelineInput } from '@/lib/workspace-timeline/types';

/** Build portfolio-level forecasting input from workspace timeline data. */
export function buildPortfolioForecastingInput(
  input: WorkspaceTimelineInput
): CommercialForecastingInput | null {
  const hasData =
    input.fundingSources.length > 0 ||
    input.obligations.length > 0 ||
    input.business != null;

  if (!hasData) return null;

  const currency = input.business?.currency ?? 'AUD';
  const obligationRows: BriefingObligationRowInput[] = input.obligations.map(
    (row) => ({
      id: row.id,
      deal_id: row.deal_id,
      obligation_type: row.obligation_type,
      status: row.status,
      amount_owed: row.amount_owed,
      currency: row.currency,
      participant: row.participant
        ? {
            name: row.participant.name ?? 'Participant',
            role: row.participant.role ?? '',
          }
        : null,
    })
  );

  return {
    currency,
    fundingSources: input.fundingSources,
    treasury: null,
    obligationRows,
    releaseConfidence: null,
    openingCashBalance:
      input.business?.commercial.forecast.forecastPosition.forecastBalance ?? 0,
    asOfDate: input.currentDate,
  };
}
