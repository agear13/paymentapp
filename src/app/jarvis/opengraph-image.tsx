import { ImageResponse } from 'next/og';

export const alt = 'Jarvis by Provvy — Talk to Provvy. It gets the work done.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function JarvisOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(145deg, #12081f 0%, #2a1654 52%, #7C5CFF 100%)',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.8 }}>
          Early access waitlist
        </div>
        <div style={{ marginTop: 24, fontSize: 68, fontWeight: 600, lineHeight: 1.05 }}>
          What if your business had a Jarvis?
        </div>
        <div style={{ marginTop: 28, fontSize: 32, opacity: 0.9 }}>
          Talk to Provvy. It gets the work done.
        </div>
      </div>
    ),
    size
  );
}
