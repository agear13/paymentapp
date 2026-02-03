'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function TeamProgressPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<any>(null);
  const [hunt, setHunt] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [conversions, setConversions] = useState<any[]>([]);
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamProgress();
  }, [teamId]);

  const loadTeamProgress = async () => {
    try {
      const supabase = createClient();

      // Load team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*, hunts(*)')
        .eq('id', teamId)
        .single();

      setTeam(teamData);
      setHunt(teamData?.hunts);

      if (teamData?.hunt_id) {
        // Load stops
        const { data: stopsData } = await supabase
          .from('stops')
          .select('*')
          .eq('hunt_id', teamData.hunt_id)
          .order('order_index', { ascending: true });

        setStops(stopsData || []);

        // Load completions
        const { data: completionsData } = await supabase
          .from('stop_completions')
          .select('stop_id')
          .eq('team_id', teamId);

        setCompletions(new Set(completionsData?.map(c => c.stop_id) || []));

        // Load conversions
        const { data: conversionsData } = await supabase
          .from('conversions')
          .select(`
            *,
            challenges (title, type),
            sponsors (name)
          `)
          .eq('team_id', teamId)
          .order('created_at', { ascending: false });

        setConversions(conversionsData || []);

        // Load NFTs
        const { data: nftsData } = await supabase
          .from('nfts')
          .select(`
            *,
            stops (name, venue_name)
          `)
          .eq('team_id', teamId)
          .order('minted_at', { ascending: false });

        setNfts(nftsData || []);
      }
    } catch (error) {
      console.error('Failed to load team progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!team) {
    return <div className="p-8">Team not found</div>;
  }

  const completedCount = completions.size;
  const progress = stops.length > 0 ? (completedCount / stops.length) * 100 : 0;
  const approvedConversions = conversions.filter(c => c.status === 'approved').length;
  const pendingConversions = conversions.filter(c => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-6xl mx-auto space-y-6 py-8">
        {/* Team Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Trophy className="h-8 w-8 text-primary" />
                  {team.name}
                </CardTitle>
                <CardDescription className="text-base">
                  {hunt?.name}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hunt Progress</span>
                <span className="font-medium">{completedCount} / {stops.length} stops completed</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Completed Stops</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">NFTs Collected</p>
                <p className="text-2xl font-bold">{nfts.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Approved Conversions</p>
                <p className="text-2xl font-bold text-green-500">{approvedConversions}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-500">{pendingConversions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Conversions */}
          <Card>
            <CardHeader>
              <CardTitle>Conversions Submitted</CardTitle>
              <CardDescription>Web3 challenges completed</CardDescription>
            </CardHeader>
            <CardContent>
              {conversions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Challenge</TableHead>
                      <TableHead>Sponsor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversions.map((conversion) => (
                      <TableRow key={conversion.id}>
                        <TableCell className="font-medium">
                          {conversion.challenges?.title}
                        </TableCell>
                        <TableCell>{conversion.sponsors?.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              conversion.status === 'approved'
                                ? 'success'
                                : conversion.status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {conversion.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No conversions yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* NFTs */}
          <Card>
            <CardHeader>
              <CardTitle>NFT Souvenirs</CardTitle>
              <CardDescription>Collectibles minted</CardDescription>
            </CardHeader>
            <CardContent>
              {nfts.length > 0 ? (
                <div className="space-y-3">
                  {nfts.map((nft) => (
                    <div
                      key={nft.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{nft.stops?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {nft.stops?.venue_name}
                        </p>
                      </div>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${nft.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No NFTs minted yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stops Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Stop Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stops.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{stop.name}</p>
                      <p className="text-xs text-muted-foreground">{stop.venue_name}</p>
                    </div>
                  </div>
                  {completions.has(stop.id) ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
