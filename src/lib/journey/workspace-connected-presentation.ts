import type { SubscriptionPlan } from '@/lib/entitlements/types';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
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

export type XeroOfferKind =
  | 'recommended_connect'
  | 'available_connect'
  | 'unavailable';

export type ConnectedSystemsNextKind = 'connect_xero' | 'manage_xero' | 'enter_workspace';

export type ConnectedSystemsPresentation = {
  audience: ConnectedSystemsAudience;
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
  next: {
    message: string;
    primary: {
      kind: ConnectedSystemsNextKind;
      href: string;
      label: string;
    };
  };
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
  if (input.entitlementsLoading) return null;
  if (input.hasActiveFirstPartyTrial) return 'active_first_party_trial';
  if (input.trialExpired) return 'expired_first_party_trial';
  if (input.xeroAllowed) return 'entitled_paid';
  return 'legacy_starter';
}

function trialNoteFor(
  audience: ConnectedSystemsAudience | null,
  trialEndsAt: string | Date | null | undefined,
  now: Date
): string | null {
  if (audience !== 'active_first_party_trial') return null;
  const days = remainingTrialDays(trialEndsAt, now);
  if (days == null) {
    return 'Professional features, including Xero, are available during your trial.';
  }
  if (days === 0) {
    return 'Professional features, including Xero, are available during your trial.';
  }
  const dayLabel = days === 1 ? '1 day remaining' : `${days} days remaining`;
  return `Professional features, including Xero, are available during your trial · ${dayLabel}.`;
}

function nextForConnectedState(state: XeroConnectionState | null | undefined): {
  message: string;
  primary: ConnectedSystemsPresentation['next']['primary'];
} {
  if (state === 'AUTH_REAUTH_REQUIRED') {
    return {
      message: 'Reconnect Xero to restore accounting sync. Existing account mappings are kept.',
      primary: {
        kind: 'manage_xero',
        href: COMMERCIAL_OS_ROUTES.connectedXero,
        label: 'Manage Xero',
      },
    };
  }
  if (state === 'READY') {
    return {
      message: 'Xero is ready to sync. Open Manage to review accounts or historical payments.',
      primary: {
        kind: 'manage_xero',
        href: COMMERCIAL_OS_ROUTES.connectedXero,
        label: 'Manage Xero',
      },
    };
  }
  return {
    message: 'Open accounting setup to choose accounts and check sync status.',
    primary: {
      kind: 'manage_xero',
      href: COMMERCIAL_OS_ROUTES.connectedXero,
      label: 'Continue setup',
    },
  };
}

export function buildConnectedSystemsPresentation(
  input: ConnectedSystemsPresentationInput
): ConnectedSystemsPresentation {
  const now = input.now ?? new Date();
  const selectedXero = assessmentSelectedXero(input.accounting);
  const audience = resolveConnectedSystemsAudience(input);
  const xeroUsable = !input.entitlementsLoading && input.xeroAllowed;
  const connectionKnown = input.connectionKnown !== false;
  const xeroConnected = connectionKnown && input.xeroConnected;

  const base: Omit<ConnectedSystemsPresentation, 'title' | 'description' | 'xeroOffer' | 'next'> = {
    audience: audience ?? 'legacy_starter',
    selectedXero,
    xeroConnected,
    xeroUsable,
    trialNote: trialNoteFor(audience, input.trialEndsAt, now),
    showReadinessBanner: xeroConnected && xeroUsable,
  };

  if (!connectionKnown) {
    return {
      ...base,
      title:
        audience === 'expired_first_party_trial'
          ? 'Your workspace is still here.'
          : audience === 'active_first_party_trial' && selectedXero
            ? 'Connect the systems you already use.'
            : 'Your operating infrastructure.',
      description:
        audience === 'expired_first_party_trial'
          ? 'Your Professional Trial has ended. You can still view your workspace and existing data.'
          : audience === 'active_first_party_trial' && selectedXero
            ? 'Provvy knows you use Xero because you told us during setup. Checking whether it is connected…'
            : 'Checking which systems are actually connected to Provvy.',
      xeroOffer: null,
      next: {
        message: 'Continue into your Commercial Operating System.',
        primary: {
          kind: 'enter_workspace',
          href: COMMERCIAL_OS_ROUTES.workspace,
          label: 'Enter workspace',
        },
      },
    };
  }

  if (xeroConnected) {
    const next = nextForConnectedState(input.xeroConnectionState);
    if (audience === 'expired_first_party_trial') {
      return {
        ...base,
        title: 'Your workspace is still here.',
        description:
          'Your Professional Trial has ended. Xero is still connected — you can view your existing workspace and data.',
        showReadinessBanner: false,
        xeroOffer: null,
        next: {
          message: 'You can still open your workspace and review existing connected systems.',
          primary: {
            kind: 'enter_workspace',
            href: COMMERCIAL_OS_ROUTES.workspace,
            label: 'Enter workspace',
          },
        },
      };
    }
    return {
      ...base,
      title: 'Your operating infrastructure.',
      description: selectedXero
        ? 'Xero is connected to Provvy. The next step is to finish setup or start using it in your workspace.'
        : 'Every system Provvy is connected to feeds directly into your Commercial Operating System.',
      xeroOffer: null,
      next,
    };
  }

  if (audience === 'active_first_party_trial' && selectedXero) {
    return {
      ...base,
      title: 'Connect the systems you already use.',
      description:
        'Provvy knows you use Xero because you told us during setup. Xero is not connected yet.',
      xeroOffer: {
        kind: 'recommended_connect',
        title: 'Xero',
        detail: 'Accounting · not connected',
        explanation:
          'Your Professional Trial includes Xero integration. Connecting it is the recommended next step.',
        showConnect: true,
        recommended: true,
      },
      next: {
        message: 'Connect Xero so invoices and payments can sync automatically.',
        primary: {
          kind: 'connect_xero',
          href: COMMERCIAL_OS_ROUTES.connected,
          label: 'Connect Xero',
        },
      },
    };
  }

  if (audience === 'active_first_party_trial') {
    return {
      ...base,
      title: 'Your operating infrastructure.',
      description:
        'Xero integration is included in your Professional Trial. Connect it if you use Xero — Provvy has not assumed that you do.',
      xeroOffer: {
        kind: 'available_connect',
        title: 'Xero',
        detail: 'Accounting · available on your trial',
        explanation: 'A Professional capability you can connect now. No card is required during the trial.',
        showConnect: true,
        recommended: false,
      },
      next: {
        message: 'Continue into your Commercial Operating System.',
        primary: {
          kind: 'enter_workspace',
          href: COMMERCIAL_OS_ROUTES.workspace,
          label: 'Enter workspace',
        },
      },
    };
  }

  if (audience === 'expired_first_party_trial') {
    return {
      ...base,
      title: 'Your workspace is still here.',
      description:
        'Your Professional Trial has ended. You can still view your workspace and existing data.',
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
      next: {
        message: 'You can still open your workspace, review existing data, and visit billing settings when you are ready.',
        primary: {
          kind: 'enter_workspace',
          href: COMMERCIAL_OS_ROUTES.workspace,
          label: 'Enter workspace',
        },
      },
    };
  }

  if (audience === 'entitled_paid') {
    return {
      ...base,
      title: 'Your operating infrastructure.',
      description: selectedXero
        ? 'Provvy knows you use Xero because you told us during setup. Xero is not connected yet.'
        : 'Connect Xero to sync invoices and payments. This is a Professional capability on your plan.',
      xeroOffer: {
        kind: selectedXero ? 'recommended_connect' : 'available_connect',
        title: 'Xero',
        detail: 'Accounting · not connected',
        explanation: selectedXero
          ? 'Connecting Xero is the recommended next step.'
          : 'Xero integration is included on your plan.',
        showConnect: true,
        recommended: selectedXero,
      },
      next: {
        message: selectedXero
          ? 'Connect Xero so invoices and payments can sync automatically.'
          : 'Continue into your Commercial Operating System.',
        primary: selectedXero
          ? {
              kind: 'connect_xero',
              href: COMMERCIAL_OS_ROUTES.connected,
              label: 'Connect Xero',
            }
          : {
              kind: 'enter_workspace',
              href: COMMERCIAL_OS_ROUTES.workspace,
              label: 'Enter workspace',
            },
      },
    };
  }

  return {
    ...base,
    title: 'Your operating infrastructure.',
    description:
      'Every system Provvy is connected to feeds directly into your Commercial Operating System.',
    xeroOffer: null,
    next: {
      message: 'Continue into your Commercial Operating System.',
      primary: {
        kind: 'enter_workspace',
        href: COMMERCIAL_OS_ROUTES.workspace,
        label: 'Enter workspace',
      },
    },
  };
}
