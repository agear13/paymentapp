import { notFound } from 'next/navigation';
import { JarvisRecordFrame } from '@/components/jarvis/jarvis-record-frame';
import { canServeJarvisRecordingPage } from '@/lib/jarvis/jarvis-recording-mode';

/**
 * TEMPORARY — development-only recording frame for Jarvis demo videos.
 * Does not send mail, write to the database, or change public /jarvis.
 *
 * http://localhost:3000/dev/jarvis-record
 */
export default function JarvisRecordPage() {
  if (!canServeJarvisRecordingPage()) {
    notFound();
  }

  return <JarvisRecordFrame />;
}
