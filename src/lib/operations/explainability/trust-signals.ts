import type { TrustSignal, TrustLevel } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

export type TrustSignalsInput = {
  workspace: WorkspaceOperationalContext;
  treasury?: ProjectTreasurySummary | null;
  lastSyncedAt?: string | null;
  reconciliationOk?: boolean;
};

function signal(
  id: string,
  label: string,
  status: TrustLevel,
  detail?: string
): TrustSignal {
  return { id, label, status, detail };
}

/**
 * Operational trust indicators — calm, factual safety signals (not marketing).
 */
export function deriveTrustSignals(input: TrustSignalsInput): TrustSignal[] {
  const { workspace, treasury } = input;
  const signals: TrustSignal[] = [];

  const provider =
    workspace.stripeConfigured || workspace.wiseConfigured || workspace.hederaConfigured;

  if (provider) {
    const rails: string[] = [];
    if (workspace.stripeConfigured) rails.push('Stripe');
    if (workspace.wiseConfigured) rails.push('Wise');
    if (workspace.hederaConfigured) rails.push('Hedera');
    signals.push(
      signal('provider', `${rails.join(' & ')} connected`, 'healthy', 'Collection rails active')
    );
  } else {
    signals.push(
      signal('provider', 'No payment provider connected', 'attention', 'Connect before collecting revenue')
    );
  }

  if (input.reconciliationOk === true) {
    signals.push(signal('reconcile', 'Accounts reconciled', 'healthy'));
  } else if (input.reconciliationOk === false) {
    signals.push(signal('reconcile', 'Reconciliation needs review', 'attention'));
  } else if (treasury?.projectHealth === 'healthy' || treasury?.projectHealth === 'ready_for_payout') {
    signals.push(signal('reconcile', 'Treasury health stable', 'healthy', treasury.fundingLabel));
  } else if (treasury?.projectHealth === 'settlement_risk') {
    signals.push(signal('reconcile', 'Settlement risk flagged', 'risk', treasury.fundingSubcopy));
  } else {
    signals.push(signal('reconcile', 'Reconciliation pending setup', 'unknown', 'Connect funding to enable'));
  }

  const participantsConfigured =
    workspace.participantCount > 0 &&
    workspace.participantsConfiguredCount >= workspace.participantCount;

  if (workspace.releaseEligibleCount > 0 && participantsConfigured) {
    signals.push(
      signal(
        'release',
        'Release pre-checks passing',
        'healthy',
        `${workspace.releaseEligibleCount} obligation${workspace.releaseEligibleCount === 1 ? '' : 's'} eligible`
      )
    );
  } else if (workspace.participantCount > 0 && !participantsConfigured) {
    signals.push(
      signal(
        'release',
        'Release safety reduced',
        'attention',
        'Configure participant earnings before release'
      )
    );
  } else {
    signals.push(signal('release', 'Release not yet eligible', 'unknown'));
  }

  if (workspace.obligationCount > 0) {
    const pending = workspace.obligationCount - workspace.releaseEligibleCount;
    if (pending > 0) {
      signals.push(
        signal(
          'obligations',
          `${pending} obligation${pending === 1 ? '' : 's'} require approval or funding`,
          'attention'
        )
      );
    } else {
      signals.push(signal('obligations', 'Obligations aligned for coordination', 'healthy'));
    }
  }

  if (input.lastSyncedAt) {
    signals.push(
      signal('freshness', 'Data synced', 'healthy', `Last sync ${input.lastSyncedAt}`)
    );
  } else {
    signals.push(signal('freshness', 'Live operational snapshot', 'healthy'));
  }

  if (treasury && !treasury.hasFundingSources) {
    signals.push(
      signal('funding', 'No funding sources on project', 'attention', 'Add revenue before release')
    );
  }

  return signals;
}
