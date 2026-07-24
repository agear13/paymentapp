import Link from 'next/link';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';

type ProvvyBrandMarkProps = {
  href?: string;
  wordmark?: string;
};

/** Lovable landing uses "Provvy" — reuse Provvypay mark with journey wordmark. */
export function ProvvyBrandMark({ href = '/journey', wordmark = 'Provvy' }: ProvvyBrandMarkProps) {
  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2">
        <ProvvypayLogoMark href={undefined} showWordmark={false} size="sm" />
        <span className="text-[15px] font-semibold tracking-tight">{wordmark}</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ProvvypayLogoMark href={undefined} showWordmark={false} size="sm" />
      <span className="text-[15px] font-semibold tracking-tight">{wordmark}</span>
    </div>
  );
}
