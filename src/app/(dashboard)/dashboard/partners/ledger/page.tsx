import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { LedgerEntryDialog } from '@/components/partners/ledger-entry-dialog';

export default async function PartnerLedgerPage() {
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
    .select(`
      *,
      partner_entities (
        name,
        entity_type
      )
    `)
    .eq('program_id', program?.id || '')
    .order('created_at', { ascending: false });

  const ledgerEntries = entries || [];

  const totalPending = ledgerEntries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0);

  const totalPaid = ledgerEntries
    .filter(e => e.status === 'paid')
    .reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings Ledger</h1>
        <p className="text-muted-foreground">
          Detailed transaction history of all revenue share allocations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ledgerEntries.length}</div>
            <p className="text-xs text-muted-foreground">Allocation records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Successfully paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Click on any row to view detailed transaction information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No ledger entries yet. Approve HuntPay conversions to create entries.
                  </TableCell>
                </TableRow>
              ) : (
                ledgerEntries.map((entry) => (
                  <LedgerEntryDialog key={entry.id} entry={entry}>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-medium max-w-md truncate">
                        {entry.description || 'HuntPay conversion'}
                      </TableCell>
                      <TableCell>
                        {entry.partner_entities?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.source}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {entry.currency} ${parseFloat(entry.earnings_amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.status === 'paid'
                              ? 'success'
                              : entry.status === 'pending'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </LedgerEntryDialog>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

