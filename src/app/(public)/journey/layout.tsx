import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provvy — Commercial Operating System',
  description: 'Start your commercial assessment and deploy the right workflow.',
};

export default function JourneyRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
