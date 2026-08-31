export const JARVIS_RECORDING_PATH = '/dev/jarvis-record';

/**
 * Dev-only recording surface. Always false in production so cookie consent
 * and public /jarvis cannot be bypassed by a query string or path.
 */
export const canServeJarvisRecordingPage = (
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean => nodeEnv !== 'production';

export const isJarvisRecordingMode = (
  pathname: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean => canServeJarvisRecordingPage(nodeEnv) && pathname === JARVIS_RECORDING_PATH;
