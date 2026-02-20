/**
 * Wise Payment Option Component
 * Bank transfer via Wise – create transfer and show payer instructions with copy
 */

'use client';

import { useState } from 'react';
import { Building2, Check, Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WisePaymentOptionProps {
  isAvailable: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  paymentLinkId: string;
  shortCode: string;
  amount: string;
  currency: string;
}

interface WiseInstructions {
  type?: string;
  reference?: string;
  transferId?: string;
  accountHolderName?: string;
  currency?: string;
  bankDetails?: {
    legalName?: string;
    iban?: string;
    accountNumber?: string;
    sortCode?: string;
    bic?: string;
    routingNumber?: string;
  };
  message?: string;
}

export const WisePaymentOption: React.FC<WisePaymentOptionProps> = ({
  isAvailable,
  isSelected,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
  shortCode,
  amount,
  currency,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [instructions, setInstructions] = useState<WiseInstructions | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const fetchInstructions = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setInstructions(null);
    try {
      const res = await fetch(`/api/public/pay/${shortCode}/wise`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load payment details');
      setInstructions(data.instructions ?? { reference: data.transferId, transferId: data.transferId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payment details');
    } finally {
      setIsLoading(false);
    }
  };

  const instr = instructions;
  const ref = instr?.reference ?? instr?.transferId ?? '';

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={isAvailable ? onSelect : undefined}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        disabled={!isAvailable}
        className={cn(
          'w-full text-left transition-all rounded-lg border-2 p-4',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
          {
            'border-emerald-600 bg-emerald-50 shadow-md': isSelected,
            'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm':
              !isSelected && isAvailable,
            'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed': !isAvailable,
          }
        )}
        role="radio"
        aria-checked={isSelected}
        aria-disabled={!isAvailable}
        aria-label="Pay via Wise bank transfer"
        tabIndex={isAvailable ? 0 : -1}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full transition-colors',
              {
                'bg-emerald-600': isSelected,
                'bg-emerald-100': !isSelected && isAvailable,
                'bg-slate-200': !isAvailable,
              }
            )}
          >
            <Building2
              className={cn('w-6 h-6', {
                'text-white': isSelected,
                'text-emerald-600': !isSelected && isAvailable,
                'text-slate-400': !isAvailable,
              })}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-slate-900">Wise (Bank transfer)</h3>
              {isSelected && (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Pay by bank transfer using Wise. You’ll get payment reference and bank details.
            </p>
            {!isAvailable && (
              <p className="text-xs text-amber-600 mt-3 font-medium">
                Wise is not available for this merchant
              </p>
            )}
          </div>
        </div>
      </button>

      {isSelected && isAvailable && (
        <div className="rounded-lg border border-emerald-200 bg-white p-4 space-y-4">
          {!instr ? (
            <Button
              onClick={fetchInstructions}
              disabled={isLoading}
              className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading payment details...
                </>
              ) : (
                <>Get payment details – {currency} {amount}</>
              )}
            </Button>
          ) : (
            <>
              <h4 className="font-semibold text-slate-900">How to pay</h4>
              <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2">
                <li>Open your bank app or online banking.</li>
                <li>Make a transfer to the details below.</li>
                <li>Use the payment reference exactly as shown.</li>
                <li>We’ll update the status when we receive your payment.</li>
              </ol>
              {ref && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Payment reference</label>
                  <div className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 font-mono text-sm">
                    <span className="flex-1 break-all">{ref}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard('reference', ref)}
                    >
                      {copied === 'reference' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {instr.bankDetails?.iban && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">IBAN</label>
                  <div className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 font-mono text-sm">
                    <span className="flex-1 break-all">{instr.bankDetails.iban}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        copyToClipboard('iban', instr.bankDetails!.iban!)
                      }
                    >
                      {copied === 'iban' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {instr.accountHolderName && (
                <p className="text-sm text-slate-600">
                  Account name: <strong>{instr.accountHolderName}</strong>
                </p>
              )}
              {instr.message && (
                <p className="text-sm text-slate-600">{instr.message}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
