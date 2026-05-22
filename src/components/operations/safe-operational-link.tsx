'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import {
  resolveSafeOperationalRoute,
  type OperationalRouteIntent,
} from '@/lib/operations/routing/operational-route-recovery';

type SafeOperationalLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  intent: OperationalRouteIntent;
  projectId?: string | null;
  href?: string;
};

/**
 * Guided CTA link — resolves draft-safe destinations; never points at fatal routes.
 */
export function SafeOperationalLink({
  intent,
  projectId,
  href: hrefOverride,
  children,
  ...rest
}: SafeOperationalLinkProps) {
  const resolved = resolveSafeOperationalRoute(intent, { projectId });
  const href = hrefOverride ?? resolved.href;

  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
