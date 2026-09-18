import type { Metadata } from 'next';
import { ReferralManagementLandingPage } from '@/components/journey/lovable/referral-management-landing-page';
import {
  REFERRAL_LANDING_FAQS,
  REFERRAL_LANDING_METADATA,
  REFERRAL_MANAGEMENT_LANDING_PATH,
} from '@/lib/journey/referral-management-landing';

export const metadata: Metadata = {
  title: REFERRAL_LANDING_METADATA.title,
  description: REFERRAL_LANDING_METADATA.description,
  alternates: {
    canonical: REFERRAL_MANAGEMENT_LANDING_PATH,
  },
  openGraph: {
    title: REFERRAL_LANDING_METADATA.title,
    description: REFERRAL_LANDING_METADATA.description,
    type: 'website',
    url: REFERRAL_MANAGEMENT_LANDING_PATH,
  },
  twitter: {
    card: 'summary_large_image',
    title: REFERRAL_LANDING_METADATA.title,
    description: REFERRAL_LANDING_METADATA.description,
  },
};

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: REFERRAL_LANDING_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export default function ReferralManagementLandingRoutePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <ReferralManagementLandingPage />
    </>
  );
}
