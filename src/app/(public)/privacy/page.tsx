import { Metadata } from 'next';
import { ProvvypayPrivacyDocument } from '@/components/legal/provvypay-privacy-document';
import { ProvvypayPublicLegalShell } from '@/components/legal/provvypay-public-legal-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy | Provvypay',
  description: 'Provvypay Privacy Policy explaining how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <ProvvypayPublicLegalShell>
      <ProvvypayPrivacyDocument />
    </ProvvypayPublicLegalShell>
  );
}
