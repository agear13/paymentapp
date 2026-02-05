import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from '@/components/partners/dashboard-client';

export default async function PartnersDashboardPage() {
  const supabase = await createClient();

  // Get HuntPay program
  const { data: program } = await supabase
    .from('partner_programs')
    .select('id')
    .eq('slug', 'huntpay')
    .single();

  // Fetch ledger entries
  const { data: entries } = await supabase
    .from('partner_ledger_entries')
    .select('*')
    .eq('program_id', program?.id || '')
    .order('created_at', { ascending: false });

  const ledgerEntries = entries || [];

  // Calculate totals
  const totalEarnings = ledgerEntries.reduce(
    (sum, e) => sum + parseFloat(e.earnings_amount.toString()),
    0
  );

  const pendingEarnings = ledgerEntries
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0);

  const paidOut = ledgerEntries
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0);

  return (
    <DashboardClient
      totalEarnings={totalEarnings}
      pendingEarnings={pendingEarnings}
      paidOut={paidOut}
    />
  );
}

