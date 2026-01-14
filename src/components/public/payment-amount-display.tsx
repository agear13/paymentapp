/**
 * Payment Amount Display Component
 * Shows payment amount with currency formatting
 */

'use client';

import { Receipt, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentAmountDisplayProps {
  amount: string;
  currency: string;
  description: string;
  invoiceReference: string | null;
  dueDate?: string | null;
}

export const PaymentAmountDisplay: React.FC<PaymentAmountDisplayProps> = ({
  amount,
  currency,
  description,
  invoiceReference,
  dueDate,
}) => {
  // Format amount with proper decimals
  const formattedAmount = parseFloat(amount).toFixed(2);
  
  // Format due date
  const formattedDueDate = dueDate ? format(new Date(dueDate), 'PPP') : null;

  return (
    <div className="text-center">
      <div className="mb-4">
        <p className="text-sm text-slate-500 mb-2">Amount Due</p>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-xl text-slate-600 font-medium">{currency}</span>
          <span className="text-5xl font-bold text-slate-900">{formattedAmount}</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 text-left">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-slate-500 mb-1">Description</p>
            <p className="text-sm text-slate-900 leading-relaxed">{description}</p>
          </div>
          {dueDate && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Due Date</p>
                <p className="text-sm text-slate-900">{formattedDueDate}</p>
              </div>
            </div>
          )}
          {invoiceReference && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <Receipt className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Invoice Reference</p>
                <p className="text-sm font-mono text-slate-900">{invoiceReference}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};













