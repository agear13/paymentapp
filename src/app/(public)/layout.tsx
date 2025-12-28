/**
 * Public Layout
 * Minimal layout for public-facing pages (payment pages, etc.)
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provvypay - Secure Payment',
  description: 'Complete your payment securely with Provvypay',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {children}
    </div>
  );
}













