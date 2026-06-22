/**
 * Checks whether a static demo asset is available before attempting download.
 */
export async function checkStaticAssetExists(fileUrl: string): Promise<boolean> {
  try {
    const headResponse = await fetch(fileUrl, { method: 'HEAD' });
    if (headResponse.ok) return true;

    if (headResponse.status === 404) return false;

    const getResponse = await fetch(fileUrl, { method: 'GET' });
    return getResponse.ok;
  } catch {
    return false;
  }
}

/**
 * Downloads a static asset from `/public` as a file attachment (never opens in-browser preview).
 */
export async function downloadStaticAsset(fileUrl: string, downloadName: string): Promise<void> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Unable to download ${downloadName}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = downloadName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export const DEMO_DOWNLOAD_PREP_STEPS = [
  'Validating campaign',
  'Packaging deliverables',
  'Preparing report',
  'Ready',
] as const;

/** Total preparation animation duration (ms). */
export const DEMO_DOWNLOAD_PREP_DURATION_MS = 1_050;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function runDemoDownloadPreparation(onStep: (step: number) => void): Promise<void> {
  const stepDuration = Math.round(DEMO_DOWNLOAD_PREP_DURATION_MS / DEMO_DOWNLOAD_PREP_STEPS.length);
  onStep(0);
  for (let index = 0; index < DEMO_DOWNLOAD_PREP_STEPS.length; index += 1) {
    await sleep(stepDuration);
    onStep(index + 1);
  }
}
