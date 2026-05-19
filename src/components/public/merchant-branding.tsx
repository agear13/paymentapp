/**
 * Merchant Branding — logo, initials fallback, operator identity on customer pages.
 */

'use client';

import * as React from 'react';

import { merchantInitials } from '@/lib/branding/resolve-merchant-branding';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const LOGO_MAX_HEIGHT_PX = 56;
const LOGO_MAX_WIDTH_PX = 200;

interface MerchantBrandingProps {
  merchantName: string;
  logoUrl?: string | null;
  className?: string;
}

function logClientLogoFailure(merchantName: string, logoUrl: string, reason: string) {
  console.warn('[MerchantBranding]', {
    context: 'MerchantBranding.client',
    merchantName,
    logoUrl,
    reason,
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}

export const MerchantBranding: React.FC<MerchantBrandingProps> = ({
  merchantName,
  logoUrl,
  className,
}) => {
  const initials = merchantInitials(merchantName);
  const [imageState, setImageState] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>(
    logoUrl ? 'loading' : 'idle'
  );

  React.useEffect(() => {
    setImageState(logoUrl ? 'loading' : 'idle');
  }, [logoUrl]);

  const showInitials = !logoUrl || imageState === 'error';
  const showLogo = !!logoUrl && imageState !== 'error';

  return (
    <div className={cn('text-center', className)}>
      <div
        className="inline-flex items-center justify-center mb-3 mx-auto"
        style={{ minHeight: LOGO_MAX_HEIGHT_PX, maxWidth: LOGO_MAX_WIDTH_PX }}
      >
        {showLogo ? (
          <>
            {imageState === 'loading' ? (
              <Skeleton
                className="rounded-md"
                style={{ width: LOGO_MAX_WIDTH_PX, height: LOGO_MAX_HEIGHT_PX }}
                aria-hidden
              />
            ) : null}
            <img
              src={logoUrl}
              alt={`${merchantName} logo`}
              className={cn(
                'max-h-14 max-w-[200px] w-auto h-auto object-contain',
                imageState === 'loading' ? 'hidden' : 'block'
              )}
              style={{ maxHeight: LOGO_MAX_HEIGHT_PX, maxWidth: LOGO_MAX_WIDTH_PX }}
              onLoad={() => setImageState('loaded')}
              onError={() => {
                logClientLogoFailure(merchantName, logoUrl, 'image_load_failed');
                setImageState('error');
              }}
            />
          </>
        ) : null}

        {showInitials ? (
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100"
            aria-hidden
          >
            <span className="text-sm font-semibold text-blue-700">{initials}</span>
          </div>
        ) : null}
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">{merchantName}</h1>
      <p className="text-sm text-slate-500">Payment request</p>
    </div>
  );
};

export { merchantInitials };
