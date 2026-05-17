'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';

export function ProjectFundingView() {
  const { summary } = useProjectWorkspace();
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Funding and invoices for this project.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Funding status
          </CardTitle>
          <CardDescription>Collect funds via invoices and payment links tied to this work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="outline">{summary.fundingLabel}</Badge>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/payment-links?action=create">Create invoice</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/payments">Payments workspace</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
