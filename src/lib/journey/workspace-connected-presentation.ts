import type { SubscriptionPlan } from '@/lib/entitlements/types';
import type { XeroConnectionState } from '@/lib/xero/xero-connection-state';

export const ASSESSMENT_XERO = 'Xero';

export function assessmentSelectedXero(accounting?: string | null): boolean {
  return accounting?.trim() === ASSESSMENT_XERO;
}

export function remainingTrialDays(
  trialEndsAt: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (trialEndsAt == null) return null;
  const end = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export type ConnectedSystemsAudience =
  | 'active_first_party_trial'
  | 'expired_first_party_trial'
  | 'legacy_starter'
  | 'entitled_paid';

export type ConnectedSystemsMode = 'setup' | 'infrastructure' | 'expired' | 'legacy_empty';

export type XeroOfferKind = 'recommended_connect' | 'available_connect' | 'unavailable';

export type ConnectedSystemsPresentation = {
  audience: ConnectedSystemsAudience;
  mode: ConnectedSystemsMode;
  selectedXero: boolean;
  xeroConnected: boolean;
  xeroUsable: boolean;
  title: string;
  description: string;
  trialNote: string | null;
  showReadinessBanner: boolean;
  xeroOffer: {
    kind: XeroOfferKind;
    title: string;
    detail: string;
    explanation: string;
    showConnect: boolean;
    recommended: boolean;
  } | null;
};

export type ConnectedSystemsPresentationInput = {
  accounting?: string | null;
  xeroConnected: boolean;
  xeroConnectionState?: XeroConnectionState | null;
  entitlementsLoading?: boolean;
  hasActiveFirstPartyTrial: boolean;
  trialExpired: boolean;
  trialEndsAt?: string | Date | null;
  xeroAllowed: boolean;
  plan: SubscriptionPlan;
  now?: Date;
  /** False while live /api/xero/status has not resolved. Assessment is never used as a substitute. */
  connectionKnown?: boolean;
};

export function resolveConnectedSystemsAudience(input: {
  entitlementsLoading?: boolean;
  hasActiveFirstPartyTrial: boolean;
  trialExpired: boolean;
  xeroAllowed: boolean;
  plan: SubscriptionPlan;
}): ConnectedSystemsAudience | null {
  if (input.hasActiveFirstPartyTrial) return 'active_first_party_trial';
  if (input.trialExpired) return 'expired_first_party_trial';
  if (input.xeroAllowed) return 'entitled_paid';
  if (input.entitlementsLoading) return null;
  return 'legacy_starter';
}

function trialNoteFor(
  audience: ConnectedSystemsAudience | null,
  trialEndsAt: string | Date | null | undefined,
  now: Date
): string | null {
  if (audience !== 'active_first_party_trial') return null;
  const days = remainingTrialDays(trialEndsAt, now);
  if (days == null || days === 0) {
    return 'Professional features, including Xero, are available during your trial.';
  }
  const dayLabel = days === 1 ? '1 day remaining' : `${days} days remaining`;
  return `Professional features, including Xero, are available during your trial · ${dayLabel}.`;
}

function setupXeroOffer(selectedXero: boolean, showConnect: boolean): NonNullable<
  ConnectedSystemsPresentation['xeroOffer']
> {
  if (selectedXero) {
    return {
      kind: 'recommended_connect',
      title: 'Xero',
      detail: 'Accounting · not connected',
      explanation:
        'Provvy knows you use Xero because you told us during setup. It is not connected yet. Your Professional Trial includes Xero integration — connecting it is the recommended next step.',
      showConnect,
      recommended: true,
    };
  }
  return {
    kind: 'available_connect',
    title: 'Xero',
    detail: 'Accounting · available on your trial',
    explanation:
      'Xero is included in your Professional Trial. Connect it if you use Xero — Provvy has not assumed that you do.',
    showConnect,
    recommended: false,
  };
}

export function buildConnectedSystemsPresentation(
  input: ConnectedSystemsPresentationInput
): ConnectedSystemsPresentation {
  const now = input.now ?? new Date();
  const selectedXero = assessmentSelectedXero(input.accounting);
  const audience = resolveConnectedSystemsAudience(input);
  const xeroUsable = input.hasActiveFirstPartyTrial || input.xeroAllowed;
  const confirmedConnected = input.connectionKnown !== false && input.xeroConnected;

  const trialNote = trialNoteFor(audience, input.trialEndsAt, now);

  if (confirmedConnected) {
    const expired = audience === 'expired_first_party_trial';
    return {
      audience: audience ?? 'entitled_paid',
      mode: expired ? 'expired' : 'infrastructure',
      selectedXero,
      xeroConnected: true,
      xeroUsable,
      title: expired ? 'Your workspace is still here.' : 'Your operating infrastructure.',
      description: expired
        ? 'Your Professional Trial has ended. Xero is still connected — you can view your existing workspace and data.'
        : selectedXero
          ? 'Xero is connected to Provvy. Review the live connection or continue setup.'
          : 'Every system Provvy is connected to feeds directly into your Commercial Operating System.',
      trialNote: expired ? null : trialNote,
      showReadinessBanner: !expired && xeroUsable,
      xeroOffer: null,
    };
  }

  if (audience === 'expired_first_party_trial') {
    return {
      audience,
      mode: 'expired',
      selectedXero,
      xeroConnected: false,
      xeroUsable: false,
      title: 'Your workspace is still here.',
      description:
        'Your Professional Trial has ended. You can still view your workspace and existing data. Professional integrations are not available to connect right now.',
      trialNote: null,
      showReadinessBanner: false,
      xeroOffer: {
        kind: 'unavailable',
        title: 'Xero',
        detail: 'Accounting · not available',
        explanation: selectedXero
          ? 'You told us you use Xero during setup, but it is not connected. Xero integration is not available to connect while the trial is expired.'
          : 'Xero integration is a Professional capability. It is not available to connect while the trial is expired.',
        showConnect: false,
        recommended: false,
      },
    };
  }

  if (audience === 'legacy_starter') {
    return {
      audience,
      mode: 'legacy_empty',
      selectedXero,
      xeroConnected: false,
      xeroUsable: false,
      title: 'Connected systems',
      description: selectedXero
        ? 'No systems are connected to Provvy yet. Xero is not included on the Starter plan.'
        : 'No systems are connected to Provvy yet.',
      trialNote: null,
      showReadinessBanner: false,
      xeroOffer: null,
    };
  }

  const showConnect = xeroUsable || Boolean(input.entitlementsLoading);
  const paidSetup = audience === 'entitled_paid';

  return {
    audience: audience ?? 'active_first_party_trial',
    mode: 'setup',
    selectedXero,
    xeroConnected: false,
    xeroUsable,
    title: 'Connect your systems',
    description: selectedXero
      ? 'Provvy knows you use Xero because you told us during setup. Connecting it lets Provvy coordinate invoices, payments and commercial activity.'
      : 'Connecting the tools you already use lets Provvy coordinate commercial activity across invoices, payments and accounting.',
    trialNote: paidSetup ? null : trialNote,
    showReadinessBanner: false,
    xeroOffer: paidSetup
      ? {
          kind: selectedXero ? 'recommended_connect' : 'available_connect',
          title: 'Xero',
          detail: 'Accounting · not connected',
          explanation: selectedXero
            ? 'Provvy knows you use Xero because you told us during setup. It is not connected yet. Connecting it is the recommended next step.'
            : 'Xero integration is included on your plan. Connect it if you use Xero — Provvy has not assumed that you do.',
          showConnect,
          recommended: selectedXero,
        }
      : setupXeroOffer(selectedXero, showConnect),
  };
}
