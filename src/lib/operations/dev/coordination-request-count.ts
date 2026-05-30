'use client';

type CoordinationRequestCountSnapshot = {
  page: string;
  activation: number;
  coordinationSnapshot: number;
};

let activePage: string | null = null;
let activationCount = 0;
let snapshotCount = 0;

export function beginCoordinationRequestCount(page: string): void {
  activePage = page;
  activationCount = 0;
  snapshotCount = 0;
}

export function recordCoordinationActivationRequest(): void {
  activationCount += 1;
}

export function recordCoordinationSnapshotRequest(): void {
  snapshotCount += 1;
}

export function getCoordinationRequestCountSnapshot(): CoordinationRequestCountSnapshot | null {
  if (!activePage) return null;
  return {
    page: activePage,
    activation: activationCount,
    coordinationSnapshot: snapshotCount,
  };
}

export function flushCoordinationRequestCount(): CoordinationRequestCountSnapshot | null {
  const snapshot = getCoordinationRequestCountSnapshot();
  if (!snapshot) return null;
  console.info('[coordination-request-count]', snapshot);
  activePage = null;
  activationCount = 0;
  snapshotCount = 0;
  return snapshot;
}

export function resetCoordinationRequestCountForTests(): void {
  activePage = null;
  activationCount = 0;
  snapshotCount = 0;
}
