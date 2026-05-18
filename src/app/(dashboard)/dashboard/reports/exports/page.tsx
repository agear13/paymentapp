import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { REPORTS_LEDGER_HREF } from '@/lib/navigation/operator-nav';

export default function ReportsExportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exports</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Download financial summaries, ledger extracts, and reconciliation packages for accounting
          workflows.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4" />
              Financial summary
            </CardTitle>
            <CardDescription>
              Revenue, cashflow, and allocation summaries from the reports overview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard/reports">Open reports overview</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Ledger extract
            </CardTitle>
            <CardDescription>
              Review entries and balances, then export from the ledger workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm" asChild>
              <Link href={REPORTS_LEDGER_HREF}>Open ledger</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
