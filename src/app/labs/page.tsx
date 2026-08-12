import type { Metadata } from 'next';
import { ProvvyLabsPage } from '@/components/labs';

export const metadata: Metadata = {
  title: "Provvy Labs — Build Your Business's AI Layer",
  description:
    'Build your Company Brain once, then deploy AI Teams when your business needs them. Productised AI implementation from Provvy Labs.',
  openGraph: {
    title: "Provvy Labs — Build Your Business's AI Layer",
    description:
      'Company Brain implementation plus credit-based AI Teams, starting with the AI Marketing Team.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function LabsRoutePage() {
  return <ProvvyLabsPage />;
}
