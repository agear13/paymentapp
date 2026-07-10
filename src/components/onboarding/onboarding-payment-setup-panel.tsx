'use client';

import * as React from 'react';
import { Check, Circle, ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import {
  phaseLabel,
  type OperationalOnboardingPhase,
} from '@/lib/operations/onboarding/operational-onboarding-phases';
import { cn } from '@/lib/utils';

const TASK_ITEMS = [
  { id: 'provider', label: 'Connect Stripe' },
  { id: 'compensation', label: 'Choose payout method' },
  { id: 'revenue', label: 'Add bank account' },
  { id: 'participants', label: 'Invite participants' },
] as const;

const OPERATOR_PHASE_LABELS: Partial<Record<OperationalOnboardingPhase, string>> = {
  PAYMENT_RAIL_INITIALIZED: 'Payment setup connected',
  OPERATIONAL_GRAPH_READY: 'Project data ready',
};

function operatorPhaseLabel(phase: OperationalOnboardingPhase): string {
  return OPERATOR_PHASE_LABELS[phase] ?? phaseLabel(phase);
}

/** Task-oriented payment setup for onboarding — what to do before accepting money. */
export function OnboardingPaymentSetupPanel() {
  const { activation, operationalOnboarding, operationalInitialization, refresh } =
    useWorkspaceActivation();
  const [technicalOpen, setTechnicalOpen] = React.useState(false);

  React.useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  if (!activation) return null;

  const checklistById = new Map(activation.checklist.map((item) => [item.id, item]));

  const tasks = TASK_ITEMS.map((task) => {
    const item = checklistById.get(task.id);
    return {
      id: task.id,
      label: task.label,
      complete: item?.complete ?? false,
    };
  });

  const pendingCount = tasks.filter((t) => !t.complete).length;

  const technicalLines: string[] = [];
  if (operationalOnboarding?.phase) {
    technicalLines.push(operatorPhaseLabel(operationalOnboarding.phase));
  }
  if (operationalInitialization?.pendingPhases.length) {
    technicalLines.push(
      `${operationalInitialization.pendingPhases.length} background step(s) pending`
    );
  }
  if (activation.activationBlockers.length > 0) {
    technicalLines.push(...activation.activationBlockers);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Things left to do</p>
        <p className="text-sm text-muted-foreground">
          {pendingCount > 0
            ? 'What do you need to do before you can start accepting money?'
            : "You're ready to collect and pay out."}
        </p>
      </div>

      <ul className="rounded-lg border border-border/40 bg-background px-4 py-3 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={cn(
              'flex items-center gap-2.5 text-sm transition-colors duration-300',
              task.complete ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {task.complete ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0 animate-in zoom-in-50 duration-200" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            )}
            {task.label}
          </li>
        ))}
      </ul>

      {technicalLines.length > 0 ? (
        <Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-muted-foreground hover:bg-transparent"
            >
              View technical details
              <ChevronDown
                className={cn('ml-1 h-3.5 w-3.5 transition-transform', technicalOpen && 'rotate-180')}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <ul className="text-xs text-muted-foreground space-y-1 rounded-md bg-muted/30 px-3 py-2">
              {technicalLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

/** @deprecated Use OnboardingPaymentSetupPanel */
export function OnboardingProviderChecklist() {
  return <OnboardingPaymentSetupPanel />;
}
