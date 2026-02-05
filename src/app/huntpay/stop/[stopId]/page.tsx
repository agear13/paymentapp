'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, ExternalLink, Upload, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Challenge {
  id: string;
  type: 'venue' | 'web3';
  title: string;
  instructions_md: string;
  sponsor_id?: string;
  sponsor_referral_url?: string;
  conversion_type?: string;
  sponsors?: {
    name: string;
    website_url: string;
  };
}

export default function StopPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const stopId = params.stopId as string;
  const teamId = searchParams.get('team') || localStorage.getItem('huntpay_team_id');
  const checkinCode = searchParams.get('code');

  const [stop, setStop] = useState<any>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [conversions, setConversions] = useState<Record<string, any>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasMinted, setHasMinted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proofData, setProofData] = useState<Record<string, { txHash?: string; note?: string }>>({});

  useEffect(() => {
    loadStopData();
  }, [stopId, teamId]);

  useEffect(() => {
    if (checkinCode && !isCheckedIn) {
      handleCheckin();
    }
  }, [checkinCode]);

  const loadStopData = async () => {
    try {
      const supabase = createClient();

      // Load stop
      const { data: stopData } = await supabase
        .from('stops')
        .select('*')
        .eq('id', stopId)
        .single();

      setStop(stopData);

      // Load challenges
      const { data: challengesData } = await supabase
        .from('challenges')
        .select(`
          *,
          sponsors (name, website_url)
        `)
        .eq('stop_id', stopId)
        .order('order_index', { ascending: true });

      setChallenges(challengesData || []);

      if (teamId) {
        // Check if team has checked in
        const { data: checkin } = await supabase
          .from('stop_checkins')
          .select('id')
          .eq('team_id', teamId)
          .eq('stop_id', stopId)
          .single();

        setIsCheckedIn(!!checkin);

        // Check if stop is completed
        const { data: completion } = await supabase
          .from('stop_completions')
          .select('id')
          .eq('team_id', teamId)
          .eq('stop_id', stopId)
          .single();

        setIsCompleted(!!completion);

        // Load conversions
        const { data: conversionsData } = await supabase
          .from('conversions')
          .select('*')
          .eq('team_id', teamId)
          .eq('stop_id', stopId);

        const conversionMap: Record<string, any> = {};
        conversionsData?.forEach(c => {
          conversionMap[c.challenge_id] = c;
        });
        setConversions(conversionMap);

        // Check if NFT minted
        const { data: nft } = await supabase
          .from('nfts')
          .select('id')
          .eq('team_id', teamId)
          .eq('stop_id', stopId)
          .single();

        setHasMinted(!!nft);
      }
    } catch (error) {
      console.error('Failed to load stop:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!teamId || !checkinCode) return;

    try {
      const response = await fetch('/api/huntpay/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, stopId, checkinCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Check-in failed');
      }

      setIsCheckedIn(true);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitProof = async (challengeId: string, challenge: Challenge) => {
    if (!teamId) return;

    try {
      const proof = proofData[challengeId] || {};
      
      const response = await fetch('/api/huntpay/conversions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          stopId,
          challengeId,
          sponsorId: challenge.sponsor_id,
          conversionType: challenge.conversion_type || 'other',
          txHash: proof.txHash,
          note: proof.note,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit proof');
      }

      await loadStopData();
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCompleteStop = async () => {
    if (!teamId) return;

    try {
      const response = await fetch('/api/huntpay/stops/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, stopId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete stop');
      }

      setIsCompleted(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMintNFT = async () => {
    try {
      // Simplified NFT minting - in production, integrate with Web3 wallet
      // For now, just mark as minted
      setHasMinted(true);
      setError('');
      
      // Optional: Call backend to record NFT mint (would need actual tx hash in production)
      await fetch('/api/huntpay/nfts/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          stopId,
          chainId: 11155111,
          contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder
          tokenId: Date.now().toString(),
          txHash: '0x' + Math.random().toString(16).substring(2), // Placeholder
        }),
      }).catch(err => console.error('Failed to record NFT:', err));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!stop) {
    return <div className="p-8">Stop not found</div>;
  }

  const allChallengesSubmitted = challenges.every(c => conversions[c.id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        {/* Stop Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{stop.name}</CardTitle>
            <CardDescription className="text-base">{stop.venue_name}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>{stop.description}</p>
            
            {!isCheckedIn && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Scan the QR code at this venue to check in and unlock challenges
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Challenges */}
        {isCheckedIn && (
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Challenges</TabsTrigger>
              <TabsTrigger value="venue">Venue</TabsTrigger>
              <TabsTrigger value="web3">Web3</TabsTrigger>
            </TabsList>

            {['all', 'venue', 'web3'].map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                {challenges
                  .filter(c => tab === 'all' || c.type === tab)
                  .map(challenge => {
                    const hasSubmitted = !!conversions[challenge.id];
                    const status = conversions[challenge.id]?.status;

                    return (
                      <Card key={challenge.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="flex items-center gap-2">
                                {challenge.title}
                                {hasSubmitted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                              </CardTitle>
                              <div className="flex gap-2">
                                <Badge variant="outline">{challenge.type}</Badge>
                                {challenge.sponsors && (
                                  <Badge variant="secondary">
                                    Sponsored by {challenge.sponsors.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {hasSubmitted && (
                              <Badge variant={
                                status === 'approved' ? 'success' :
                                status === 'rejected' ? 'destructive' : 'secondary'
                              }>
                                {status}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                              {challenge.instructions_md}
                            </pre>
                          </div>

                          {challenge.sponsor_referral_url && !hasSubmitted && (
                            <a
                              href={challenge.sponsor_referral_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                // Track attribution
                                fetch('/api/huntpay/attribution/track', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    teamId,
                                    stopId,
                                    challengeId: challenge.id,
                                    sponsorId: challenge.sponsor_id,
                                    referralUrl: challenge.sponsor_referral_url,
                                  }),
                                });
                              }}
                            >
                              <Button variant="outline" className="w-full">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Visit {challenge.sponsors?.name}
                              </Button>
                            </a>
                          )}

                          {!hasSubmitted && (
                            <div className="space-y-3 border-t pt-4">
                              <Label>Submit Proof</Label>
                              
                              <div className="space-y-2">
                                <Input
                                  placeholder="Transaction hash (if applicable)"
                                  value={proofData[challenge.id]?.txHash || ''}
                                  onChange={(e) =>
                                    setProofData({
                                      ...proofData,
                                      [challenge.id]: { ...proofData[challenge.id], txHash: e.target.value },
                                    })
                                  }
                                />
                                <Textarea
                                  placeholder="Notes or description"
                                  value={proofData[challenge.id]?.note || ''}
                                  onChange={(e) =>
                                    setProofData({
                                      ...proofData,
                                      [challenge.id]: { ...proofData[challenge.id], note: e.target.value },
                                    })
                                  }
                                />
                              </div>

                              <Button
                                className="w-full"
                                onClick={() => handleSubmitProof(challenge.id, challenge)}
                                disabled={!proofData[challenge.id]?.txHash && !proofData[challenge.id]?.note}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Submit Proof
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Complete Stop & Mint */}
        {isCheckedIn && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Stop</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!isCompleted ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCompleteStop}
                  disabled={!allChallengesSubmitted}
                >
                  {allChallengesSubmitted ? 'Complete Stop' : 'Submit all proofs first'}
                </Button>
              ) : (
                <>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Stop completed! Mint your NFT souvenir below.
                    </AlertDescription>
                  </Alert>

                  {!hasMinted ? (
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleMintNFT}
                    >
                      Mint NFT Souvenir
                    </Button>
                  ) : (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        NFT minted successfully! Continue to next stop.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
