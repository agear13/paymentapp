'use client';

import { useEffect } from 'react';
import { JarvisDemoEngine } from '@/components/jarvis/jarvis-demo-engine';
import { JARVIS_RECORDING_PATH } from '@/lib/jarvis/jarvis-recording-mode';
import '@/components/journey/lovable/lovable-journey.css';

export function JarvisRecordFrame() {
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-jarvis-record-chrome', 'true');
    style.textContent = [
      'nextjs-portal,[data-next-badge-root],[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none!important;visibility:hidden!important;pointer-events:none!important}',
      'html.jarvis-recording,html.jarvis-recording body{overflow:hidden}',
    ].join('');
    document.documentElement.classList.add('jarvis-recording');
    document.head.appendChild(style);
    return () => {
      style.remove();
      document.documentElement.classList.remove('jarvis-recording');
    };
  }, []);

  return (
    <div
      data-jarvis-recording="true"
      data-recording-path={JARVIS_RECORDING_PATH}
      className="lovable-journey dark flex min-h-dvh items-center justify-center overflow-x-hidden bg-background px-3 py-4 text-foreground antialiased sm:px-6"
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-70" />
      <div className="relative w-full max-w-2xl">
        <JarvisDemoEngine compact />
      </div>
    </div>
  );
}
