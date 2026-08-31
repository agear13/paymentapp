import {
  jarvisDemoAudioPath,
  playJarvisDemoAudio,
  resolveJarvisDemoAudioSrc,
} from '@/lib/jarvis/jarvis-demo-audio';

describe('Jarvis demo audio', () => {
  it('resolves a drop-in public path without requiring the file to exist', () => {
    expect(jarvisDemoAudioPath('invoice-execution')).toBe('/jarvis-demo/invoice-execution.mp3');
    expect(resolveJarvisDemoAudioSrc({ src: '/jarvis-demo/invoice-execution.mp3', mimeType: 'audio/mpeg' })).toBe(
      '/jarvis-demo/invoice-execution.mp3'
    );
    expect(resolveJarvisDemoAudioSrc(null)).toBeNull();
  });

  it('treats missing or failing clips as unavailable instead of synthesizing speech', async () => {
    await expect(playJarvisDemoAudio(null)).resolves.toBe('unavailable');
    await expect(
      playJarvisDemoAudio('/jarvis-demo/missing.mp3', () => {
        throw new Error('no file');
      })
    ).resolves.toBe('unavailable');
  });
});
