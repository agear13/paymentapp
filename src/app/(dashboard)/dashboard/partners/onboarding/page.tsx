'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    payoutMethod: '',
    programType: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      alert('Please accept the terms and conditions');
      return;
    }
    // Store program type in localStorage for display on dashboard
    if (formData.programType) {
      localStorage.setItem('partnerProgramType', formData.programType);
    }
    // Navigate to partner dashboard (no real backend)
    router.push('/dashboard/partners/dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Partner Onboarding</h1>
        <p className="text-muted-foreground">
          Join our revenue share program and start earning from attributed merchants
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Partner Information</CardTitle>
                <CardDescription>
                  Provide your details to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Partner Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    required
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="contributor">Contributor</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the role that best describes your relationship
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="program-type">Program Type *</Label>
                  <Select
                    value={formData.programType}
                    onValueChange={(value) => setFormData({ ...formData, programType: value })}
                    required
                  >
                    <SelectTrigger id="program-type">
                      <SelectValue placeholder="Select program type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Affiliate/Referral">Affiliate/Referral</SelectItem>
                      <SelectItem value="Revenue Share">Revenue Share</SelectItem>
                      <SelectItem value="Contributor Payouts">Contributor Payouts</SelectItem>
                      <SelectItem value="Staking Rewards Distribution">Staking Rewards Distribution</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the type of program you&apos;re joining
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payout-method">Preferred Payout Method *</Label>
                  <Select
                    value={formData.payoutMethod}
                    onValueChange={(value) => setFormData({ ...formData, payoutMethod: value })}
                    required
                  >
                    <SelectTrigger id="payout-method">
                      <SelectValue placeholder="Select payout method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="crypto">Crypto Wallet</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="wire">Wire Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    You can update this later in your settings
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
                <CardDescription>
                  Review and accept the revenue share terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I accept the revenue share terms and conditions
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      By accepting, you agree to our partner program terms, including revenue
                      allocation rules and payout schedules.
                    </p>
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={!termsAccepted}>
                  Activate Partner Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Share Terms Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Share Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Standard Rate</p>
                      <p className="text-xs text-muted-foreground">
                        15% revenue share on attributed merchants
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Bi-Weekly Payouts</p>
                      <p className="text-xs text-muted-foreground">
                        Automated payouts every 2 weeks
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Performance Bonuses</p>
                      <p className="text-xs text-muted-foreground">
                        Earn up to 20% on high-value accounts
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Real-Time Tracking</p>
                      <p className="text-xs text-muted-foreground">
                        Live dashboard with earnings and ledger
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Multiple Payment Methods</p>
                      <p className="text-xs text-muted-foreground">
                        Bank transfer, crypto, PayPal, or wire
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Need help? Contact our partner support team at{' '}
                    <a href="mailto:partners@provvypay.com" className="text-primary hover:underline">
                      partners@provvypay.com
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

