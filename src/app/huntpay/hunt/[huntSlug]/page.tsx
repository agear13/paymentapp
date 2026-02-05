'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MapPin, Lock, CheckCircle2, QrCode, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Stop {
  id: string;
  name: string;
  venue_name: string;
  description: string;
  order_index: number;
  gps_hint: string;
}

interface StopStatus {
  stopId: string;
  isCheckedIn: boolean;
  isCompleted: boolean;
}

export default function HuntOverviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const huntSlug = params.huntSlug as string;
  const teamId = searchParams.get('team') || localStorage.getItem('huntpay_team_id');

  const [hunt, setHunt] = useState<any>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopStatuses, setStopStatuses] = useState<Record<string, StopStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHuntData();
  }, [huntSlug, teamId]);

  const loadHuntData = async () => {
    try {
      const supabase = createClient();

      // Load hunt
      const { data: huntData } = await supabase
        .from('hunts')
        .select('*')
        .eq('slug', huntSlug)
        .single();

      if (!huntData) {
        throw new Error('Hunt not found');
      }

      setHunt(huntData);

      // Load stops
      const { data: stopsData } = await supabase
        .from('stops')
        .select('*')
        .eq('hunt_id', huntData.id)
        .order('order_index', { ascending: true });

      setStops(stopsData || []);

      // Load team progress if teamId exists
      if (teamId) {
        const { data: checkins } = await supabase
          .from('stop_checkins')
          .select('stop_id')
          .eq('team_id', teamId);

        const { data: completions } = await supabase
          .from('stop_completions')
          .select('stop_id')
          .eq('team_id', teamId);

        const checkedInStops = new Set(checkins?.map(c => c.stop_id) || []);
        const completedStops = new Set(completions?.map(c => c.stop_id) || []);

        const statuses: Record<string, StopStatus> = {};
        stopsData?.forEach(stop => {
          statuses[stop.id] = {
            stopId: stop.id,
            isCheckedIn: checkedInStops.has(stop.id),
            isCompleted: completedStops.has(stop.id),
          };
        });

        setStopStatuses(statuses);
      }
    } catch (error) {
      console.error('Failed to load hunt:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <p>Loading hunt...</p>
        </div>
      </div>
    );
  }

  if (!hunt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Hunt Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/huntpay/join">
                <Button>Join a Hunt</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const completedCount = Object.values(stopStatuses).filter(s => s.isCompleted).length;
  const progress = stops.length > 0 ? (completedCount / stops.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        {/* Hunt Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-3xl">{hunt.name}</CardTitle>
                <CardDescription>{hunt.description}</CardDescription>
              </div>
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{completedCount} / {stops.length} stops</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {teamId && (
              <Link href={`/huntpay/team/${teamId}`}>
                <Button variant="outline" className="w-full">
                  View Team Progress
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Stops List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Hunt Stops</h2>
          
          {stops.map((stop, index) => {
            const status = stopStatuses[stop.id];
            const isLocked = !status?.isCheckedIn;
            const isCompleted = status?.isCompleted;
            
            return (
              <Card key={stop.id} className={isCompleted ? 'border-green-500' : isLocked ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {stop.name}
                          {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                          {isLocked && <Lock className="h-5 w-5 text-muted-foreground" />}
                        </CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {stop.venue_name}
                          </div>
                        </CardDescription>
                      </div>
                    </div>
                    
                    {isCompleted ? (
                      <Badge variant="success">Completed</Badge>
                    ) : status?.isCheckedIn ? (
                      <Badge variant="secondary">In Progress</Badge>
                    ) : (
                      <Badge variant="outline">Locked</Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{stop.description}</p>
                  
                  {stop.gps_hint && (
                    <p className="text-xs text-muted-foreground">📍 {stop.gps_hint}</p>
                  )}

                  {isCompleted ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completed
                    </Button>
                  ) : status?.isCheckedIn ? (
                    <Link href={`/huntpay/stop/${stop.id}?team=${teamId}`}>
                      <Button className="w-full">
                        Continue Stop
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" className="w-full" disabled={!teamId}>
                      <QrCode className="mr-2 h-4 w-4" />
                      Check In Required
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
