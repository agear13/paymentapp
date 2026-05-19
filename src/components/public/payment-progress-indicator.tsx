/**
 * Payment Progress Indicator — operational multi-stage progression for customer payment flows.
 */

'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PAYMENT_FLOW_STAGES,
  stageOrder,
  stageSubtext,
  type PaymentFlowStage,
} from '@/lib/payments/payment-flow-stages';

interface PaymentProgressIndicatorProps {
  currentStage: PaymentFlowStage;
}

export const PaymentProgressIndicator: React.FC<PaymentProgressIndicatorProps> = ({
  currentStage,
}) => {
  const currentOrder = stageOrder(currentStage);
  const activeSubtext = stageSubtext(currentStage);

  return (
    <div className="space-y-3" role="progressbar" aria-valuenow={currentOrder} aria-valuemin={1} aria-valuemax={4}>
      <div className="flex items-start justify-center gap-1 sm:gap-2">
        {PAYMENT_FLOW_STAGES.map((step, index) => {
          const isComplete = step.order < currentOrder;
          const isCurrent =
            step.id === currentStage ||
            (currentStage === 'awaiting_verification' && step.id === 'confirm_payment');
          const isUpcoming = step.order > currentOrder;

          return (
            <div key={step.id} className="flex items-start min-w-0 flex-1 max-w-[140px] sm:max-w-none">
              <div className="flex flex-col items-center w-full">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0',
                    {
                      'bg-green-600 text-white': isComplete,
                      'bg-blue-600 text-white ring-2 ring-blue-200': isCurrent,
                      'bg-slate-200 text-slate-400': isUpcoming,
                    }
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{step.order}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-[11px] sm:text-xs font-medium text-center leading-tight px-0.5',
                    {
                      'text-green-700': isComplete,
                      'text-blue-700': isCurrent,
                      'text-slate-400': isUpcoming,
                    }
                  )}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </div>
              {index < PAYMENT_FLOW_STAGES.length - 1 ? (
                <div
                  className={cn('w-full h-0.5 mt-4 mx-0.5 sm:mx-2 transition-colors shrink', {
                    'bg-green-600': isComplete,
                    'bg-slate-200': !isComplete,
                  })}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {activeSubtext ? (
        <p className="text-xs text-center text-muted-foreground px-2">{activeSubtext}</p>
      ) : null}
    </div>
  );
};
