import type { Metadata } from 'next';
import { JarvisPage } from '@/components/jarvis/jarvis-page';

const TITLE = 'Jarvis by Provvy — Talk to Provvy. It gets the work done.';
const DESCRIPTION =
  'Join the waitlist for early access to Jarvis: a future Provvy capability where you speak naturally and Provvy coordinates commercial workflows. Not generally available yet.';
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/jarvis' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/jarvis',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function JarvisRoutePage() {
  return <JarvisPage />;
}
