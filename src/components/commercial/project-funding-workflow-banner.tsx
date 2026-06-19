'use client';

/**
 * ProjectFundingWorkflowBanner
 *
 * Lightweight workflow status panel for the Funding page.
 * Derives status from participant counts available in the workspace context —
 * no deep engine calls required.
 *
 * Shows:
 *   - Supplier onboarding progress (counts from participant fields)
 *   - CTA routing to the Participants page for detailed management
 *   - Accounting review prompt when ?section=accounting is active
 *
 * This is the entry point to the commercial workflow on the Funding page.
 * The full CommercialWorkflowMoneyPanel and AccountingApprovalReview are
 * mounted here when deeper engine data becomes available via the data hooks.
 */

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, ArrowRight, Users, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  projectSupplierOnboardingPath,
  projectXeroExportPath,
} from '@/lib/projects/project-routes';

type OnboardingCounts = {
  total: number;
  completed: number;
  pending: number;
};

function deriveOnboardingCounts(participants: Array<{
  approvalStatus?: string;
  payoutVerificationConfirmed?: boolean;
  payoutOnboardingPhase?: string;
  onboardingStatus?: string;
}>): OnboardingCounts {
  const approved = participants.filter((p) => p.approvalStatus === 'Approved');
  const completed = approved.filter(
    (p) =>
      p.payoutVerificationConfirmed === true ||
      p.payoutOnboardingPhase === 'COMPLETED' ||
      p.onboardingStatus === 'COMPLETE'
  );
  return {
    total: approved.length,
    completed: completed.length,
    pending: approved.length - completed.length,
  };
}

/**
 * Shown at the top of the Funding page when there are participants who have
 * approved their agreements but not yet completed supplier onboarding.
 */
export function ProjectFundingWorkflowBanner() {
  const { projectId, projectParticipants, loading } = useProjectWorkspace();
  const searchParams = useSearchParams();
  const showAccountingSection = searchParams?.get('section') === 'accounting';

  const counts = React.useMemo(
    () => deriveOnboardingCounts(projectParticipants),
    [projectParticipants]
  );

  if (loading || counts.total === 0) return null;

  const allComplete = counts.pending === 0;

  return (
    <div className="space-y-3">
      {/* ── Supplier Onboarding Progress ─────────────────────────────────── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Supplier Onboarding</span>
          </div>
          {allComplete ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">All complete</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {counts.completed} / {counts.total} complete
            </span>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          {!allComplete && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0}%`,
                }}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {allComplete
              ? `All ${counts.total} supplier${counts.total !== 1 ? 's have' : ' has'} completed onboarding. Invoice details, ABN, and bank details are confirmed.`
              : `${counts.pending} supplier${counts.pending !== 1 ? 's' : ''} still need${counts.pending === 1 ? 's' : ''} to complete bank details, ABN, and GST status before settlement can begin.`
            }
          </p>

          {!allComplete && (
            <div className="flex items-center gap-2 pt-1">
              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs text-muted-foreground">
                Settlement is blocked until all onboarding is complete
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button asChild size="sm" variant={allComplete ? 'outline' : 'default'}>
              <Link href={projectSupplierOnboardingPath(projectId)}>
                {allComplete ? 'View onboarding record' : 'Manage supplier onboarding'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Accounting Review (shown when ?section=accounting) ────────────── */}
      {showAccountingSection && (
        <div className="rounded-lg border bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 dark:border-amber-900/40">
            <FileText className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold">Accounting Review Required</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Supplier onboarding has been approved. Review each invoice before pushing to Xero.
                Open the Participants page to review individual supplier invoices and approve them for export.
              </p>
            </div>
            <Button asChild size="sm" variant="default">
              <Link href={projectSupplierOnboardingPath(projectId)}>
                Review invoices for export
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
