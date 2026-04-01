import { redirect } from 'next/navigation';

export default function PaymentLinkSettingsRedirectPage() {
  redirect('/dashboard/settings/merchant');
}

