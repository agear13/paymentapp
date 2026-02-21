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

interface WiseBankDetails {
  id?: number;
  currency?: string;
  bankCode?: string;
  accountNumber?: string;
  swift?: string;
  bic?: string;
  iban?: string;
  bankName?: string;
  accountHolderName?: string;
  legalName?: string;
  sortCode?: string;
  routingNumber?: string;
  bankAddress?: {
    addressFirstLine?: string;
    city?: string;
    country?: string;
    postCode?: string;
  };
}

interface WiseInstructions {
  reference: string;
  amount?: string;
  currency?: string;
  recipient?: {
    name?: string;
    accountDetails?: WiseBankDetails[];
  };
  instructions?: {
    type?: string;
    details?: WiseBankDetails | null;
  };
  // Legacy fields for backwards compatibility
  type?: string;
  transferId?: string;
  accountHolderName?: string;
  bankDetails?: WiseBankDetails;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/public/pay/${shortCode}/wise`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to load payment details';
        const code = data.code || '';
        
        // Show specific error messages based on error code
        if (code === 'WISE_DISABLED') {
          setErrorMessage('Wise payments are not enabled on this platform.');
        } else if (code === 'WISE_TOKEN_MISSING') {
          setErrorMessage('Wise API is not configured. Please contact support.');
        } else if (code === 'WISE_NOT_ENABLED') {
          setErrorMessage('This merchant has not enabled Wise payments.');
        } else if (code === 'WISE_PROFILE_MISSING') {
          setErrorMessage('Wise profile is not configured for this merchant.');
        } else if (code === 'WISE_API_ERROR') {
          setErrorMessage(`Wise API error: ${msg}`);
        } else {
          setErrorMessage(msg);
        }
        return;
      }
      setInstructions(data.instructions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load payment details';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const instr = instructions;
  const ref = instr?.reference ?? instr?.transferId ?? '';
  // Get bank details from new structure or legacy structure
  const bankDetails = instr?.instructions?.details || instr?.bankDetails;
  const recipientName = instr?.recipient?.name || instr?.accountHolderName;

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
              Pay by bank transfer using Wise. You&apos;ll get payment reference and bank details.
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
          {errorMessage ? (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700 font-medium">Unable to load Wise payment details</p>
              <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
              <Button
                onClick={fetchInstructions}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Try again
              </Button>
            </div>
          ) : !instr ? (
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
                <>Get payment details - {currency} {amount}</>
              )}
            </Button>
          ) : (
            <>
              <h4 className="font-semibold text-slate-900">How to pay</h4>
              <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2">
                <li>Open your bank app or online banking.</li>
                <li>Make a transfer to the details below.</li>
                <li>Use the payment reference exactly as shown.</li>
                <li>We&apos;ll update the status when we receive your payment.</li>
              </ol>

              {/* Amount */}
              {instr.amount && instr.currency && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-sm text-slate-600">Amount to transfer:</p>
                  <p className="text-xl font-bold text-emerald-700">{instr.currency} {instr.amount}</p>
                </div>
              )}

              {/* Payment Reference */}
              {ref && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Payment reference (required)</label>
                  <div className="flex items-center gap-2 rounded border-2 border-emerald-300 bg-emerald-50 px-3 py-2 font-mono text-sm">
                    <span className="flex-1 break-all font-semibold">{ref}</span>
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

              {/* Recipient Name */}
              {recipientName && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Account name</label>
                  <div className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex-1">{recipientName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard('name', recipientName)}
                    >
                      {copied === 'name' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* IBAN */}
              {bankDetails?.iban && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">IBAN</label>
                  <div className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 font-mono text-sm">
                    <span className="flex-1 break-all">{bankDetails.iban}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard('iban', bankDetails.iban!)}
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

              {/* Account Number */}
              {bankDetails?.accountNumber && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Account number</label>
                  <div className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 font-mono text-sm">
                    <span className="flex-1 break-all">{bankDetails.accountNumber}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard('account', bankDetails.accountNumber!)}
                    >
                      {copied === 'account' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* BIC/SWIFT */}
              {(bankDetails?.swift || bankDetails?.bic) && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">BIC/SWIFT</label>
                  <div className="flex items-center gap-2 rounded border bg-slate-50 px-3 py-2 font-mono text-sm">
                    <span className="flex-1">{bankDetails.swift || bankDetails.bic}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard('swift', (bankDetails.swift || bankDetails.bic)!)}
                    >
                      {copied === 'swift' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Bank Name */}
              {bankDetails?.bankName && (
                <p className="text-sm text-slate-600">
                  Bank: <strong>{bankDetails.bankName}</strong>
                </p>
              )}

              {/* Legacy message */}
              {instr.message && (
                <p className="text-sm text-slate-600">{instr.message}</p>
              )}

              <p className="text-xs text-slate-500 mt-4">
                Send a bank transfer using the reference above. We&apos;ll match your payment automatically.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
