'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AI_TEAM_REPORTS_PLACEHOLDER } from '@/lib/marketing-labs/placeholder-data';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';

function formatReportDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AiTeamReportsSection() {
  const reports = AI_TEAM_REPORTS_PLACEHOLDER;

  return (
    <section id="ai-team-reports" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI Team Reports</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every completed campaign includes a detailed AI Team Performance Report showing what the AI
          produced, time saved, and recommendations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance reports</CardTitle>
          <CardDescription>Download reports for completed campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <MarketingEmptyState message="Completed campaigns automatically generate AI Team Reports." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.campaign}</TableCell>
                    <TableCell>{formatReportDate(report.date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]"
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled>
                        <Download className="mr-2 size-4" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
