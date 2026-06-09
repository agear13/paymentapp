import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from '@/lib/legal/provvypay-legal-paths';

type ProvvypayLegalLinkProps = {
  className?: string;
  children: ReactNode;
};

export function ProvvypayTermsLink({ className, children }: ProvvypayLegalLinkProps) {
  return (
    <Link href={PROVVYPAY_TERMS_PATH} className={className}>
      {children}
    </Link>
  );
}

export function ProvvypayPrivacyLink({ className, children }: ProvvypayLegalLinkProps) {
  return (
    <Link href={PROVVYPAY_PRIVACY_PATH} className={className}>
      {children}
    </Link>
  );
}

export function ProvvypayLegalFooterLinks({
  termsLabel = 'Terms of Service',
  privacyLabel = 'Privacy Policy',
  className = 'flex items-center gap-6',
  linkClassName = 'hover:text-primary transition-colors',
}: {
  termsLabel?: string;
  privacyLabel?: string;
  className?: string;
  linkClassName?: string;
}) {
  return (
    <div className={className}>
      <ProvvypayPrivacyLink className={linkClassName}>{privacyLabel}</ProvvypayPrivacyLink>
      <ProvvypayTermsLink className={linkClassName}>{termsLabel}</ProvvypayTermsLink>
    </div>
  );
}

export function ProvvypayLegalSubscriptionNotice({
  className = 'text-xs text-muted-foreground text-center',
  linkClassName = 'text-primary hover:text-[rgb(var(--primary-hover))] font-medium transition-colors',
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <p className={className}>
      By subscribing, you agree to our{' '}
      <ProvvypayTermsLink className={linkClassName}>Terms of Service</ProvvypayTermsLink> and{' '}
      <ProvvypayPrivacyLink className={linkClassName}>Privacy Policy</ProvvypayPrivacyLink>.
    </p>
  );
}
