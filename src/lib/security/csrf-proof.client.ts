'use client';

/** TEMP: proof diagnostics for duplicate csrf-fetch.client module instances. */

export type CsrfModuleInstanceRecord = {
  loadedAt: number;
  installInterceptorAt: number | null;
  patchedWindowFetch: boolean;
  lastModuleTokenSha256: string | null;
};

export type BootstrapWorkspaceProof = {
  moduleInstanceId: string;
  requestTs: number;
  headerTokenSha256: string | null;
  moduleTokenSha256: string | null;
  patchedWindowFetchByThisInstance: boolean;
  activePatchOwnerId: string | null;
  headerWasPresent: boolean;
};

type CsrfProofWindow = Window & {
  __csrfModuleInstances?: Record<string, CsrfModuleInstanceRecord>;
  __csrfActivePatchOwnerId?: string | null;
  __csrfLastBootstrapWorkspaceProof?: BootstrapWorkspaceProof | null;
};

function proofWindow(): CsrfProofWindow | null {
  if (typeof window === 'undefined') return null;
  return window as CsrfProofWindow;
}

function encodeUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'utf8'));
  }
  throw new Error('sha256Hex: UTF-8 encoder unavailable');
}

export async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', encodeUtf8(value));
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  throw new Error('sha256Hex: Web Crypto digest unavailable');
}

export function registerCsrfModuleInstance(moduleInstanceId: string): {
  uniqueInstanceCount: number;
  allInstanceIds: string[];
} {
  const win = proofWindow();
  if (!win) {
    return { uniqueInstanceCount: 1, allInstanceIds: [moduleInstanceId] };
  }

  win.__csrfModuleInstances ??= {};
  if (!win.__csrfModuleInstances[moduleInstanceId]) {
    win.__csrfModuleInstances[moduleInstanceId] = {
      loadedAt: Math.round(performance.now()),
      installInterceptorAt: null,
      patchedWindowFetch: false,
      lastModuleTokenSha256: null,
    };
  }

  const allInstanceIds = Object.keys(win.__csrfModuleInstances);
  return { uniqueInstanceCount: allInstanceIds.length, allInstanceIds };
}

export function recordCsrfInstall(
  moduleInstanceId: string,
  opts: {
    patchedWindowFetch: boolean;
    moduleTokenSha256: string | null;
  }
): number {
  const win = proofWindow();
  const installTs = Math.round(performance.now());
  if (!win) return installTs;

  win.__csrfModuleInstances ??= {};
  const record = win.__csrfModuleInstances[moduleInstanceId] ?? {
    loadedAt: installTs,
    installInterceptorAt: null,
    patchedWindowFetch: false,
    lastModuleTokenSha256: null,
  };

  record.installInterceptorAt = installTs;
  record.patchedWindowFetch = opts.patchedWindowFetch;
  record.lastModuleTokenSha256 = opts.moduleTokenSha256;
  win.__csrfModuleInstances[moduleInstanceId] = record;

  if (opts.patchedWindowFetch) {
    win.__csrfActivePatchOwnerId = moduleInstanceId;
  }

  return installTs;
}

export function getActivePatchOwnerId(): string | null {
  return proofWindow()?.__csrfActivePatchOwnerId ?? null;
}

export function setLastBootstrapWorkspaceProof(proof: BootstrapWorkspaceProof): void {
  const win = proofWindow();
  if (!win) return;
  win.__csrfLastBootstrapWorkspaceProof = proof;
}

export function getLastBootstrapWorkspaceProof(): BootstrapWorkspaceProof | null {
  return proofWindow()?.__csrfLastBootstrapWorkspaceProof ?? null;
}

export function getCsrfInstanceRegistrySummary(): {
  uniqueInstanceCount: number;
  allInstanceIds: string[];
  activePatchOwnerId: string | null;
  instances: Record<string, CsrfModuleInstanceRecord>;
} {
  const win = proofWindow();
  const instances = win?.__csrfModuleInstances ?? {};
  const allInstanceIds = Object.keys(instances);
  return {
    uniqueInstanceCount: allInstanceIds.length,
    allInstanceIds,
    activePatchOwnerId: win?.__csrfActivePatchOwnerId ?? null,
    instances,
  };
}

/** @internal */
export function resetCsrfProofStateForTests(): void {
  const win = proofWindow();
  if (!win) return;
  delete win.__csrfModuleInstances;
  delete win.__csrfActivePatchOwnerId;
  delete win.__csrfLastBootstrapWorkspaceProof;
}
