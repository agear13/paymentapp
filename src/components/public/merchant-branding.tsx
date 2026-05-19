/**
 * Merchant Branding — logo, initials fallback, operator identity on customer pages.
 */

'use client';

import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MerchantBrandingProps {
  merchantName: string;
  logoUrl?: string | null;
  className?: string;
}

function merchantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const MerchantBranding: React.FC<MerchantBrandingProps> = ({
  merchantName,
  logoUrl,
  className,
}) => {
  const initials = merchantInitials(merchantName);

  return (
    <div className={cn('text-center', className)}>
      {logoUrl ? (
        <div className="inline-flex items-center justify-center mb-3 max-w-[200px] mx-auto">
          <img
            src={logoUrl}
            alt={`${merchantName} logo`}
            className="max-h-20 max-w-[200px] w-auto h-auto object-contain"
          />
        </div>
      ) : (
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mb-3 mx-auto"
          aria-hidden
        >
          <span className="text-sm font-semibold text-blue-700">{initials}</span>
        </div>
      )}
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{merchantName}</h1>
      <p className="text-sm text-slate-500">Payment request</p>
    </div>
  );
};
