import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import Link from 'next/link';

export default async function Home() {
  const user = await getCurrentUser();
  
  if (user) {
    // User is logged in - check onboarding status
    const organization = await getUserOrganization();
    
    if (!organization) {
      // New user - redirect to onboarding
      redirect('/onboarding');
    }
    
    // Existing user - redirect to dashboard
    redirect('/dashboard');
  }
  
  // Not logged in - show landing page
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-xl font-bold text-primary-foreground">P</span>
              </div>
              <span className="text-2xl font-bold">Provvypay</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link 
                href="/auth/login" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link 
                href="/auth/signup" 
                className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm font-medium text-primary">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Trusted by modern businesses
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Unified payments for<br />
              <span className="text-primary">modern commerce</span>
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed">
              Accept payments via Stripe and crypto wallets. Automatic reconciliation with Xero. 
              Built for SMBs who need multi-rail payments without the complexity.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/auth/signup"
                className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-4 rounded-lg text-base font-semibold transition-all shadow-sm inline-flex items-center justify-center gap-2"
              >
                Start for Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link 
                href="/auth/login"
                className="border-2 border-input hover:border-primary/50 bg-background px-8 py-4 rounded-lg text-base font-semibold transition-all inline-flex items-center justify-center gap-2"
              >
                Sign In
              </Link>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="text-sm">
                <div className="font-semibold text-foreground">Instant Setup</div>
                <div className="text-muted-foreground">No credit card required</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-sm">
                <div className="font-semibold text-foreground">Bank-Grade Security</div>
                <div className="text-muted-foreground">PCI-compliant</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-3xl blur-3xl" />
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold">Payment Link #1234</div>
                      <div className="text-sm text-muted-foreground">Coffee order</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-200 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Paid
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold font-mono">$4.50</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment method</span>
                    <span className="font-semibold">Stripe</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-green-600 font-semibold">Settled</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Xero sync</span>
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Synced
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t text-xs text-muted-foreground text-center">
                  Automatically reconciled • No manual entry
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Everything you need to get paid
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Accept payments, reconcile automatically, and manage your cash flow—all in one place
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-background rounded-xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Multi-Rail Payments</h3>
              <p className="text-muted-foreground leading-relaxed">
                Accept Stripe card payments and crypto wallet payments (Hedera/USDC/USDT) with the same simple link
              </p>
            </div>

            <div className="bg-background rounded-xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Auto Reconciliation</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every payment automatically syncs to Xero with proper categorization. No spreadsheets, no manual work
              </p>
            </div>

            <div className="bg-background rounded-xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Real-Time Reporting</h3>
              <p className="text-muted-foreground leading-relaxed">
                Track revenue, monitor payment status, and generate reports across all payment rails in real-time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-12 lg:p-16 text-center border-2 border-primary/20">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Ready to simplify your payments?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join businesses using Provvypay to accept payments and automate reconciliation
            </p>
            <Link 
              href="/auth/signup"
              className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-4 rounded-lg text-base font-semibold transition-all shadow-sm inline-flex items-center gap-2"
            >
              Get Started Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">P</span>
                </div>
                <span className="text-xl font-bold">Provvypay</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Unified payment infrastructure for modern businesses
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/auth/signup" className="hover:text-primary transition-colors">Payment Links</Link></li>
                <li><Link href="/auth/signup" className="hover:text-primary transition-colors">Invoicing</Link></li>
                <li><Link href="/auth/signup" className="hover:text-primary transition-colors">Reports</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/legal/privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link href="/legal/terms" className="hover:text-primary transition-colors">Terms</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/auth/login" className="hover:text-primary transition-colors">Sign In</Link></li>
                <li><Link href="/auth/signup" className="hover:text-primary transition-colors">Sign Up</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2026 Provvypay. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/legal/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="/legal/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
