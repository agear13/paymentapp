import { redirect } from 'next/navigation';
import { PROVVYPAY_PRIVACY_PATH } from '@/lib/legal/provvypay-legal-paths';

export default function LegacyPrivacyRedirectPage() {
  redirect(PROVVYPAY_PRIVACY_PATH);
}
