'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, CheckCircle2, ArrowRight } from 'lucide-react';

function JoinHuntPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const huntSlug = searchParams.get('hunt') || 'web3-downtown-quest';

  const [step, setStep] = useState<'info' | 'wallet' | 'complete'>('info');
  const [formData, setFormData] = useState({
    teamName: '',
    captainEmail: '',
    teamSize: 4,
    walletAddress: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateTeam = async () => {
    if (!formData.teamName || !formData.captainEmail) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/huntpay/teams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          huntSlug,
          teamName: formData.teamName,
          captainEmail: formData.captainEmail,
          teamSize: formData.teamSize,
          walletAddress: formData.walletAddress || null,
          chainId: formData.walletAddress ? 11155111 : null, // Sepolia if wallet provided
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create team');
      }

      // Store team info in localStorage
      localStorage.setItem('huntpay_team_id', data.team.id);
      localStorage.setItem('huntpay_join_token', data.joinToken);

      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToHunt = () => {
    const teamId = localStorage.getItem('huntpay_team_id');
    router.push(`/huntpay/hunt/${huntSlug}?team=${teamId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Join the Hunt</h1>
          <p className="text-muted-foreground">
            Create your team and start your Web3 Downtown Quest
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step === 'info' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step === 'info' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium">Team Info</span>
          </div>
          <div className="h-px w-12 bg-border" />
          <div className={`flex items-center gap-2 ${step === 'wallet' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step === 'wallet' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium">Connect Wallet</span>
          </div>
          <div className="h-px w-12 bg-border" />
          <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step === 'complete' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              {step === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : '3'}
            </div>
            <span className="text-sm font-medium">Ready</span>
          </div>
        </div>

        {/* Step Content */}
        {step === 'info' && (
          <Card>
            <CardHeader>
              <CardTitle>Create Your Team</CardTitle>
              <CardDescription>
                Form a team of explorers to tackle the scavenger hunt together
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name *</Label>
                <Input
                  id="teamName"
                  placeholder="The Crypto Explorers"
                  value={formData.teamName}
                  onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Captain Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="captain@example.com"
                  value={formData.captainEmail}
                  onChange={(e) => setFormData({ ...formData, captainEmail: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamSize">Team Size</Label>
                <Input
                  id="teamSize"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.teamSize}
                  onChange={(e) => setFormData({ ...formData, teamSize: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Number of people in your team (1-10)
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                className="w-full" 
                size="lg" 
                onClick={() => setStep('wallet')}
                disabled={!formData.teamName || !formData.captainEmail}
              >
                Continue to Wallet Connection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'wallet' && (
          <Card>
            <CardHeader>
              <CardTitle>Team Wallet (Optional)</CardTitle>
              <CardDescription>
                Provide a wallet address to receive NFT souvenirs and complete Web3 challenges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletAddress">
                  Wallet Address
                  <span className="text-xs text-muted-foreground ml-2">(optional)</span>
                </Label>
                <Input
                  id="walletAddress"
                  placeholder="0x... (EVM address)"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter an Ethereum wallet address (e.g., MetaMask). You can skip this and add it later.
                </p>
              </div>

              {formData.walletAddress && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Wallet Address Set!</strong>
                    <br />
                    <code className="text-xs break-all">{formData.walletAddress}</code>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleCreateTeam}
                disabled={loading}
              >
                {loading ? 'Creating Team...' : 'Create Team & Start Hunt'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={() => setStep('info')}
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'complete' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>
              <CardTitle className="text-2xl">Team Created Successfully!</CardTitle>
              <CardDescription>
                You're all set to start the Web3 Downtown Quest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-background p-4 space-y-2">
                <p className="text-sm font-medium">Your Team</p>
                <p className="text-2xl font-bold">{formData.teamName}</p>
                <p className="text-sm text-muted-foreground">
                  {formData.teamSize} {formData.teamSize === 1 ? 'member' : 'members'}
                </p>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleGoToHunt}
              >
                Start the Hunt
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function JoinHuntPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <JoinHuntPageContent />
    </Suspense>
  );
}
