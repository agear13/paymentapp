/**
 * Merchant Branding Component
 * Displays merchant name and branding
 */

'use client';

import { Building2 } from 'lucide-react';

interface MerchantBrandingProps {
  merchantName: string;
}

export const MerchantBranding: React.FC<MerchantBrandingProps> = ({
  merchantName,
}) => {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
        <Building2 className="w-6 h-6 text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{merchantName}</h1>
      <p className="text-sm text-slate-500">Secure Payment Request</p>
    </div>
  );
};













