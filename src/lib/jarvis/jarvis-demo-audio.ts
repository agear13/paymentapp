export const JARVIS_DEMO_AUDIO_BASE_PATH = '/jarvis-demo';

export type JarvisDemoAudioAsset = {
  /** Public path for the spokenResponse clip. Drop MP3s here — no speech-synthesis fallback. */
  src: string;
  mimeType: 'audio/mpeg' | 'audio/wav';
};

export const jarvisDemoAudioPath = (
  scenarioId: string,
  extension: 'mp3' | 'wav' = 'mp3'
): string => `${JARVIS_DEMO_AUDIO_BASE_PATH}/${scenarioId}.${extension}`;

export const resolveJarvisDemoAudioSrc = (
  audio: JarvisDemoAudioAsset | null | undefined
): string | null => {
  const src = audio?.src?.trim();
  return src ? src : null;
};

export type JarvisDemoAudioPlayback = 'played' | 'unavailable';

/**
 * Plays a pre-recorded clip when the file exists.
 * Missing assets, autoplay blocks, and decode errors all resolve as `unavailable`
 * so the demo continues with on-screen text.
 */
export const playJarvisDemoAudio = async (
  src: string | null,
  audioFactory: () => Pick<HTMLAudioElement, 'play' | 'pause' | 'src'> = () =>
    new Audio()
): Promise<JarvisDemoAudioPlayback> => {
  if (!src) return 'unavailable';
  try {
    const audio = audioFactory();
    audio.src = src;
    await audio.play();
    return 'played';
  } catch {
    return 'unavailable';
  }
};
