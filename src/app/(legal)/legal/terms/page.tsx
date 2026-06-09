import { redirect } from 'next/navigation';
import { PROVVYPAY_TERMS_PATH } from '@/lib/legal/provvypay-legal-paths';

export default function LegacyTermsRedirectPage() {
  redirect(PROVVYPAY_TERMS_PATH);
}
