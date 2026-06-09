import Link from 'next/link';
import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from '@/lib/legal/provvypay-legal-paths';

type AuthLegalLinksVariant = 'footer' | 'inline';

const variantClasses: Record<AuthLegalLinksVariant, { link: string; wrapper?: string }> = {
  footer: {
    link: 'hover:text-white/80 transition-colors',
    wrapper: 'flex items-center gap-6 text-sm text-white/50',
  },
  inline: {
    link: 'text-primary hover:text-[rgb(var(--primary-hover))] font-medium transition-colors',
  },
};

export function AuthLegalFooterLinks({ className }: { className?: string }) {
  const styles = variantClasses.footer;

  return (
    <div className={className ?? styles.wrapper}>
      <span>© 2026 Provvypay</span>
      <Link href={PROVVYPAY_PRIVACY_PATH} className={styles.link}>
        Privacy
      </Link>
      <Link href={PROVVYPAY_TERMS_PATH} className={styles.link}>
        Terms
      </Link>
    </div>
  );
}

export function AuthSignupLegalNotice() {
  const styles = variantClasses.inline;

  return (
    <p className="text-xs text-muted-foreground text-center leading-relaxed">
      By creating an account, you agree to our{' '}
      <Link href={PROVVYPAY_TERMS_PATH} className={styles.link}>
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link href={PROVVYPAY_PRIVACY_PATH} className={styles.link}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}

export function AuthMobileLegalLinks() {
  const styles = variantClasses.inline;

  return (
    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground lg:hidden">
      <Link href={PROVVYPAY_PRIVACY_PATH} className={styles.link}>
        Privacy
      </Link>
      <Link href={PROVVYPAY_TERMS_PATH} className={styles.link}>
        Terms
      </Link>
    </div>
  );
}
