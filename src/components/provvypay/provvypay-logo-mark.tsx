import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ProvvypayLogoMarkProps = {
  href?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap = {
  sm: { box: 'h-8 w-8', icon: 20, text: 'text-lg' },
  md: { box: 'h-10 w-10', icon: 24, text: 'text-xl' },
  lg: { box: 'h-12 w-12', icon: 28, text: 'text-2xl' },
} as const;

export function ProvvypayLogoMark({
  href = '/',
  showWordmark = true,
  size = 'md',
  className,
}: ProvvypayLogoMarkProps) {
  const s = sizeMap[size];
  const content = (
    <>
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#6A4BFF] shadow-sm',
          s.box
        )}
      >
        <Image src="/provvypay-icon.svg" alt="" width={s.icon} height={s.icon} className="brightness-0 invert" />
      </div>
      {showWordmark ? <span className={cn('font-bold tracking-tight', s.text)}>Provvypay</span> : null}
    </>
  );

  const wrapperClass = cn('flex items-center gap-2.5', className);

  if (href) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
