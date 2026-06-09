import Link from 'next/link';
import { ReactNode } from 'react';
import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from '@/lib/legal/provvypay-legal-paths';

export function ProvvypayPublicLegalShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
            >
              Provvypay
            </Link>
            <nav className="flex gap-6">
              <Link
                href={PROVVYPAY_TERMS_PATH}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Terms
              </Link>
              <Link
                href={PROVVYPAY_PRIVACY_PATH}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Privacy
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">{children}</main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Provvypay. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href={PROVVYPAY_TERMS_PATH} className="hover:text-gray-700">
              Terms of Service
            </Link>
            <Link href={PROVVYPAY_PRIVACY_PATH} className="hover:text-gray-700">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
