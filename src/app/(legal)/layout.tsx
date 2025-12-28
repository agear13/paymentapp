import Link from "next/link";
import { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                href="/legal/terms"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/legal/privacy"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/legal/cookies"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cookies
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Provvypay. All rights reserved.</p>
            <div className="mt-2 flex justify-center gap-4">
              <Link href="/legal/terms" className="hover:text-gray-700">
                Terms of Service
              </Link>
              <Link href="/legal/privacy" className="hover:text-gray-700">
                Privacy Policy
              </Link>
              <Link href="/legal/cookies" className="hover:text-gray-700">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}







