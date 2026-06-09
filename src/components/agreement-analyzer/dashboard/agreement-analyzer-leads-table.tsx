'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  AgreementAnalyzerLeadListItem,
  AgreementAnalyzerLeadListResult,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import {
  AGREEMENT_ANALYZER_LEAD_SCORE_RANGES,
  AGREEMENT_ANALYZER_LIFECYCLE_STAGES,
  LEAD_PRIORITY_BANDS,
  LEAD_RECOMMENDED_USE_CASES,
  AGREEMENT_BUSINESS_TYPES,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';

type AgreementAnalyzerLeadsTableProps = {
  initialData: AgreementAnalyzerLeadListResult;
};

function priorityVariant(band: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (band) {
    case 'IDEAL_ICP':
      return 'default';
    case 'HIGH':
      return 'default';
    case 'MEDIUM':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AgreementAnalyzerLeadsTable({ initialData }: AgreementAnalyzerLeadsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const data = initialData;

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      if (!updates.page) {
        params.delete('page');
      }

      startTransition(() => {
        router.push(`/dashboard/agreement-analyzer?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const currentFilters = useMemo(
    () => ({
      scoreRange: searchParams.get('scoreRange') ?? 'all',
      priorityBand: searchParams.get('priorityBand') ?? 'all',
      recommendedUseCase: searchParams.get('recommendedUseCase') ?? 'all',
      lifecycleStage: searchParams.get('lifecycleStage') ?? 'all',
      businessType: searchParams.get('businessType') ?? 'all',
      createdFrom: searchParams.get('createdFrom') ?? '',
      createdTo: searchParams.get('createdTo') ?? '',
    }),
    [searchParams]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Select
          value={currentFilters.scoreRange}
          onValueChange={(value) => updateFilters({ scoreRange: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Lead score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scores</SelectItem>
            {AGREEMENT_ANALYZER_LEAD_SCORE_RANGES.map((range) => (
              <SelectItem key={range} value={range}>
                {range}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.priorityBand}
          onValueChange={(value) => updateFilters({ priorityBand: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Priority band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bands</SelectItem>
            {LEAD_PRIORITY_BANDS.map((band) => (
              <SelectItem key={band} value={band}>
                {band}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.recommendedUseCase}
          onValueChange={(value) => updateFilters({ recommendedUseCase: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Use case" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All use cases</SelectItem>
            {LEAD_RECOMMENDED_USE_CASES.map((useCase) => (
              <SelectItem key={useCase} value={useCase}>
                {useCase}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.lifecycleStage}
          onValueChange={(value) => updateFilters({ lifecycleStage: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Lifecycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {AGREEMENT_ANALYZER_LIFECYCLE_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.businessType}
          onValueChange={(value) => updateFilters({ businessType: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Business type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All business types</SelectItem>
            {AGREEMENT_BUSINESS_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={currentFilters.createdFrom}
          onChange={(event) => updateFilters({ createdFrom: event.target.value || undefined })}
          aria-label="Created from"
        />

        <Input
          type="date"
          value={currentFilters.createdTo}
          onChange={(event) => updateFilters({ createdTo: event.target.value || undefined })}
          aria-label="Created to"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Business Type</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Use Case</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Viewed</TableHead>
              <TableHead>Demo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  No leads match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((lead: AgreementAnalyzerLeadListItem) => (
                <TableRow key={lead.id}>
                  <TableCell>{formatDate(lead.createdAt)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/agreement-analyzer/leads/${lead.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.companyName ?? '—'}</TableCell>
                  <TableCell>{lead.businessType ?? '—'}</TableCell>
                  <TableCell>{lead.overallScore ?? '—'}</TableCell>
                  <TableCell>
                    {lead.priorityBand ? (
                      <Badge variant={priorityVariant(lead.priorityBand)}>{lead.priorityBand}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {lead.recommendedUseCase ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.lifecycleStage}</Badge>
                  </TableCell>
                  <TableCell>{lead.reportViewed ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{lead.demoClicked ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {data.items.length} of {data.total} leads
          {isPending ? ' · Updating…' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || isPending}
            onClick={() => updateFilters({ page: String(data.page - 1) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages || isPending}
            onClick={() => updateFilters({ page: String(data.page + 1) })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
