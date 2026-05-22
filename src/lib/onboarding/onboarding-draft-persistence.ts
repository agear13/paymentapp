import type { OnboardingStep, OnboardingUseCaseId, CollectionPreferenceId } from '@/lib/onboarding/operator-onboarding-types';
import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';

const SESSION_KEY = 'provvypay.onboarding.draft';
const LOCAL_KEY = 'provvypay.onboarding.draft.backup';
const DRAFT_VERSION = 1;

export type OnboardingProjectDraft = {
  projectName: string;
  description?: string;
  estimatedValue?: string;
  defaultCurrency: string;
};

export type OnboardingWorkspaceDraft = {
  workspaceName: string;
  defaultCurrency: string;
  industry?: string;
  teamSize?: string;
};

export type OnboardingDraft = {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  step?: OnboardingStep;
  useCase?: OnboardingUseCaseId;
  context?: string;
  workspace?: OnboardingWorkspaceDraft;
  project?: OnboardingProjectDraft;
  participants?: OnboardingDraftParticipant[];
  organizationId?: string | null;
  merchantSettingsId?: string | null;
  projectId?: string | null;
  collectionPreference?: CollectionPreferenceId | null;
  lastOperationId?: string;
  lastMutationStatus?: string;
};

function isValidDraft(raw: unknown): raw is OnboardingDraft {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as OnboardingDraft;
  return d.version === DRAFT_VERSION && typeof d.savedAt === 'string';
}

function readStorage(storage: Storage): OnboardingDraft | null {
  try {
    const raw = storage.getItem(SESSION_KEY) ?? storage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === 'undefined') return emptyDraft();
  const session = readStorage(sessionStorage);
  if (session) return session;
  const local = readStorage(localStorage);
  return local ?? emptyDraft();
}

export function saveOnboardingDraft(partial: Partial<OnboardingDraft>): OnboardingDraft {
  const current = loadOnboardingDraft();
  const next: OnboardingDraft = {
    ...current,
    ...partial,
    version: DRAFT_VERSION,
    savedAt: new Date().toISOString(),
  };
  if (typeof window === 'undefined') return next;
  const serialized = JSON.stringify(next);
  try {
    sessionStorage.setItem(SESSION_KEY, serialized);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LOCAL_KEY, serialized);
  } catch {
    /* ignore */
  }
  return next;
}

export function clearOnboardingDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

export function emptyDraft(): OnboardingDraft {
  return {
    version: DRAFT_VERSION,
    savedAt: new Date().toISOString(),
  };
}

/** Legacy shim for use-case-only draft saves */
export function saveLegacyUseCaseDraft(useCase?: OnboardingUseCaseId, context?: string) {
  saveOnboardingDraft({ useCase, context });
}

export function loadLegacyUseCaseDraft(): { useCase?: OnboardingUseCaseId; context?: string } {
  const d = loadOnboardingDraft();
  return { useCase: d.useCase, context: d.context };
}
