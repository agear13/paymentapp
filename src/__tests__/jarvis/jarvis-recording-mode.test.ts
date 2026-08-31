import {
  canServeJarvisRecordingPage,
  isJarvisRecordingMode,
  JARVIS_RECORDING_PATH,
} from '@/lib/jarvis/jarvis-recording-mode';

describe('Jarvis recording mode', () => {
  it('is only active on the dev recording path outside production', () => {
    expect(isJarvisRecordingMode(JARVIS_RECORDING_PATH, 'development')).toBe(true);
    expect(isJarvisRecordingMode(JARVIS_RECORDING_PATH, 'test')).toBe(true);
    expect(canServeJarvisRecordingPage('development')).toBe(true);
  });

  it('cannot affect production behaviour', () => {
    expect(canServeJarvisRecordingPage('production')).toBe(false);
    expect(isJarvisRecordingMode(JARVIS_RECORDING_PATH, 'production')).toBe(false);
    expect(isJarvisRecordingMode('/jarvis', 'development')).toBe(false);
    expect(isJarvisRecordingMode('/jarvis?record=1', 'development')).toBe(false);
    expect(isJarvisRecordingMode('/jarvis', 'production')).toBe(false);
    expect(isJarvisRecordingMode(`${JARVIS_RECORDING_PATH}?record=1`, 'development')).toBe(false);
    expect(isJarvisRecordingMode(null, 'development')).toBe(false);
  });
});
