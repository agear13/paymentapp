import type { Metadata } from 'next';
import { InvoiceAcquisitionPage } from '@/components/journey/lovable/invoice-acquisition-page';
import {
  INVOICE_LANDING_FAQS,
  INVOICE_LANDING_METADATA,
  INVOICE_ACQUISITION_LANDING_PATH,
} from '@/lib/journey/invoice-acquisition-landing';

export const metadata: Metadata = {
  title: INVOICE_LANDING_METADATA.title,
  description: INVOICE_LANDING_METADATA.description,
  keywords: [
    'free invoice generator',
    'free invoice maker',
    'invoice generator',
    'free invoicing software',
    'invoice template',
    'create invoice online',
    'invoice from conversation',
    'payment link invoice',
    'invoice payment',
    'Xero invoice integration',
  ],
  alternates: {
    canonical: INVOICE_ACQUISITION_LANDING_PATH,
  },
  openGraph: {
    title: INVOICE_LANDING_METADATA.title,
    description: INVOICE_LANDING_METADATA.description,
    type: 'website',
    url: INVOICE_ACQUISITION_LANDING_PATH,
  },
  twitter: {
    card: 'summary_large_image',
    title: INVOICE_LANDING_METADATA.title,
    description: INVOICE_LANDING_METADATA.description,
  },
};

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: INVOICE_LANDING_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export default function InvoiceAcquisitionRoutePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <InvoiceAcquisitionPage />
    </>
  );
}
