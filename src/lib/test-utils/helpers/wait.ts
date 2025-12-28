/**
 * Wait Helpers for Tests
 */

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition()
    if (result) {
      return
    }
    await sleep(intervalMs)
  }

  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForTransaction(
  checkFn: () => Promise<boolean>,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const found = await checkFn()
    if (found) {
      return true
    }
    await sleep(intervalMs)
  }
  return false
}







