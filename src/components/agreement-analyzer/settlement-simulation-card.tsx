import {
  buildProvvypayInsight,
  DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
} from '@/lib/agreement-analyzer/extraction/build-settlement-simulation';
import type { AgreementSettlementSimulation } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { formatCurrency } from '@/lib/formatters/format-currency';

type SettlementSimulationCardProps = {
  simulation: AgreementSettlementSimulation;
  partyCount: number;
};

function formatSplitDescription(
  participant: AgreementSettlementSimulation['participants'][number]
): string {
  const parts: string[] = [];

  if (participant.percentage != null) {
    parts.push(`${participant.percentage}%`);
  }

  if (participant.fixedAmount != null) {
    parts.push(formatCurrency(participant.fixedAmount, 'AUD'));
  }

  if (parts.length === 0) {
    return '—';
  }

  const splitLabel = parts.join(' + ');
  return participant.basis ? `${splitLabel} · ${participant.basis}` : splitLabel;
}

export function SettlementSimulationCard({
  simulation,
  partyCount,
}: SettlementSimulationCardProps) {
  const provvypayInsight = buildProvvypayInsight(simulation, partyCount);
  const revenueLabel = formatCurrency(
    simulation.simulationRevenue || DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
    'AUD'
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Settlement Simulation
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">Projected payout split</h2>
        <p className="text-sm text-slate-600">
          If this agreement generated {revenueLabel} in revenue
        </p>
      </div>

      {simulation.supported ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">Party</th>
                <th className="px-3 py-2 font-medium">Split</th>
                <th className="px-3 py-2 font-medium text-right">Estimated Payout</th>
              </tr>
            </thead>
            <tbody>
              {simulation.participants.map((participant) => (
                <tr key={`${participant.party}-${participant.estimatedPayout}`} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{participant.party}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatSplitDescription(participant)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(participant.estimatedPayout, 'AUD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          {simulation.notes?.map((note) => (
            <p key={note} className="text-sm text-slate-700">
              {note}
            </p>
          ))}
        </div>
      )}

      {provvypayInsight ? (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-sm font-medium text-slate-900">Provvypay insight</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{provvypayInsight}</p>
        </div>
      ) : null}
    </section>
  );
}
