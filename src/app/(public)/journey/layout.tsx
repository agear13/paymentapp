import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provvy — Commercial Operating System',
  description: 'Tell Provvy what you are trying to do, then start working in your workspace.',
};

export default function JourneyRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
