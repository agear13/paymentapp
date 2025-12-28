/**
 * Payment Progress Indicator Component
 * Shows current step in payment flow
 */

'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentProgressIndicatorProps {
  currentStep: 'select_method' | 'processing' | 'complete';
}

const steps = [
  { id: 'select_method', label: 'Select Method', order: 1 },
  { id: 'processing', label: 'Processing', order: 2 },
  { id: 'complete', label: 'Complete', order: 3 },
];

export const PaymentProgressIndicator: React.FC<PaymentProgressIndicatorProps> = ({
  currentStep,
}) => {
  const currentStepOrder = steps.find((s) => s.id === currentStep)?.order || 1;

  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={currentStepOrder} aria-valuemin={1} aria-valuemax={3}>
      {steps.map((step, index) => {
        const isComplete = step.order < currentStepOrder;
        const isCurrent = step.id === currentStep;
        const isUpcoming = step.order > currentStepOrder;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                {
                  'bg-green-600 text-white': isComplete,
                  'bg-blue-600 text-white': isCurrent,
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

            {/* Step Label - Hidden on mobile */}
            <span
              className={cn(
                'ml-2 text-sm font-medium hidden sm:inline transition-colors',
                {
                  'text-green-600': isComplete,
                  'text-blue-600': isCurrent,
                  'text-slate-400': isUpcoming,
                }
              )}
            >
              {step.label}
            </span>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 sm:w-12 h-0.5 mx-2 transition-colors',
                  {
                    'bg-green-600': isComplete,
                    'bg-slate-200': !isComplete,
                  }
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};













