import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provvy — What’s the best way to move this money?',
  description:
    'Compare payment routes. Then connect Provvy to find what’s best for your business.',
};

export default function JourneyRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
