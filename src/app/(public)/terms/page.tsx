import { Metadata } from 'next';
import { ProvvypayTermsDocument } from '@/components/legal/provvypay-terms-document';
import { ProvvypayPublicLegalShell } from '@/components/legal/provvypay-public-legal-shell';

export const metadata: Metadata = {
  title: 'Terms of Service | Provvypay',
  description: 'Provvypay Terms of Service governing access to and use of the platform.',
};

export default function TermsPage() {
  return (
    <ProvvypayPublicLegalShell>
      <ProvvypayTermsDocument />
    </ProvvypayPublicLegalShell>
  );
}
