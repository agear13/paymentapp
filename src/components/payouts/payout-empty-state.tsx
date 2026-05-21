import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CircleDollarSign,
  History,
  Inbox,
  Landmark,
  UserCircle,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PayoutEmptyIconVariant =
  | 'default'
  | 'funding'
  | 'release'
  | 'participant'
  | 'history'
  | 'earnings';

const ICON_BY_VARIANT: Record<PayoutEmptyIconVariant, LucideIcon> = {
  default: Inbox,
  funding: Landmark,
  release: CircleDollarSign,
  participant: UserCircle,
  history: History,
  earnings: Wallet,
};

export function PayoutEmptyState({
  title,
  description,
  icon,
  iconVariant = 'default',
  action,
  className,
  compact = true,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  iconVariant?: PayoutEmptyIconVariant;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const Icon = icon ?? ICON_BY_VARIANT[iconVariant];

  if (compact) {
    return (
      <div className={cn('flex gap-2.5 py-2', className)}>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/45 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground/90 leading-snug">{description}</p>
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2.5 py-3', className)}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/45 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground/90 leading-snug">{description}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
