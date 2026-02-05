import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ParticipantsTable } from '@/components/referrals/participants-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function ParticipantsPage() {
  const supabase = await createClient();

  // Fetch all participants with program data
  const { data: participants, error } = await supabase
    .from('participants')
    .select(`
      *,
      programs (id, name, slug)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch participants:', error);
  }

  const consultantCount = participants?.filter(p => p.role === 'CONSULTANT').length || 0;
  const advocateCount = participants?.filter(p => p.role === 'CLIENT_ADVOCATE').length || 0;
  const activeCount = participants?.filter(p => p.status === 'active').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Participants</h1>
          <p className="text-gray-600">Manage consultants and client advocates</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Participant
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Consultants</CardDescription>
            <CardTitle className="text-3xl">{consultantCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Client Advocates</CardDescription>
            <CardTitle className="text-3xl">{advocateCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Participants</CardTitle>
          <CardDescription>
            View referral codes and generate shareable links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ParticipantsTable participants={participants || []} />
        </CardContent>
      </Card>
    </div>
  );
}
