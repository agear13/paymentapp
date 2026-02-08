import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConversionsTable } from '@/components/referrals/conversions-table';

export default async function ConversionsPage() {
  const supabase = await createClient();

  // Fetch all referral conversions with related data
  const { data: conversions, error } = await supabase
    .from('referral_conversions')
    .select(`
      *,
      referral_programs!referral_conversions_program_id_fkey (id, name, slug),
      referral_participants!referral_conversions_participant_id_fkey (id, name, role, referral_code)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch conversions:', error);
  }

  const pendingCount = conversions?.filter(c => c.status === 'pending').length || 0;
  const approvedCount = conversions?.filter(c => c.status === 'approved').length || 0;
  const rejectedCount = conversions?.filter(c => c.status === 'rejected').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Conversions</h1>
        <p className="text-gray-600">Review and approve conversion events</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-3xl text-green-600">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-3xl text-red-600">{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Conversions</CardTitle>
          <CardDescription>
            Approve or reject conversion events to create ledger entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConversionsTable conversions={conversions || []} />
        </CardContent>
      </Card>
    </div>
  );
}
