'use client';

/**
 * SupplierOnboardingForm
 *
 * Five-section progressive form for supplier onboarding.
 *
 * One question per screen. Suppliers never wonder "What do you need from me?"
 *
 * Sections:
 *   1. Review Generated Invoice  — confirm the auto-generated draft
 *   2. Payment Details           — bank account or alternative method
 *   3. ABN                       — validation + educational help
 *   4. GST Registration          — confirmation + educational help
 *   5. Declaration               — confirm and submit
 *
 * Design rules:
 *   - Never calculates readiness independently — uses deriveSupplierOnboardingStatus().
 *   - All validation derives from validateABN() and validateBankDetails().
 *   - Educational content lives in drawers — never on the main screen.
 *   - One primary action per section.
 */

import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Info,
  X,
  FileText,
  Building2,
  CreditCard,
  ShieldCheck,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react';

import {
  validateABN,
  validateBankDetails,
  generateDraftInvoice,
} from '@/lib/commercial/supplier-onboarding';
import { getSupplierGstTaxTreatment } from '@/lib/commercial/supplier-invoice-projection';
import type {
  SupplierOnboardingInput,
  GSTStatus,
  PaymentPreference,
  DraftInvoice,
} from '@/lib/commercial/supplier-onboarding';

/* ─── Helper: format currency ────────────────────────────────────────────── */
function fmt(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

/* ─── Educational Drawer ─────────────────────────────────────────────────── */

type DrawerProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

function EducationalDrawer({ title, children, onClose }: DrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-background border-l shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm text-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── ABN Educational Content ────────────────────────────────────────────── */
function ABNEducationalContent() {
  return (
    <>
      <div>
        <h3 className="font-semibold mb-1">What is an ABN?</h3>
        <p className="text-muted-foreground">
          An Australian Business Number (ABN) is an 11-digit number that identifies your business
          to the government and other businesses. It's issued free by the Australian Business
          Register (ABR).
        </p>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Who generally needs one?</h3>
        <ul className="space-y-1 text-muted-foreground list-none">
          {['Sole traders', 'Companies and corporations', 'Partnerships', 'Trusts'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Employees</h3>
        <p className="text-muted-foreground">
          Employees generally do not invoice using an ABN — they receive wages through payroll.
          If you are employed (not contracting), ABN may not apply to you.
        </p>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Overseas contractors</h3>
        <p className="text-muted-foreground">
          Foreign contractors may not have or require an Australian ABN. Select "Not Applicable"
          below if this applies to you.
        </p>
      </div>
      <hr />
      <div>
        <h3 className="font-semibold mb-1">How do I get an ABN?</h3>
        <ul className="space-y-1 text-muted-foreground">
          <li>• Free to apply — no cost.</li>
          <li>• Apply online through the Australian Business Register.</li>
          <li>• Usually issued within 24 hours if eligible.</li>
          <li>• You must be carrying on a business in Australia to be eligible.</li>
        </ul>
        <p className="mt-2 text-muted-foreground text-xs">
          For official guidance, visit the Australian Business Register website (abr.gov.au).
        </p>
      </div>
    </>
  );
}

/* ─── GST Educational Content ─────────────────────────────────────────────── */
function GSTEducationalContent() {
  return (
    <>
      <div>
        <h3 className="font-semibold mb-1">What does GST registration mean?</h3>
        <p className="text-muted-foreground">
          GST (Goods and Services Tax) is a 10% tax on most goods and services sold in Australia.
          When you are registered for GST, you add 10% to your invoices and remit it to the ATO.
        </p>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Who is registered?</h3>
        <p className="text-muted-foreground">
          Businesses with an annual turnover of $75,000 or more are generally required to register
          for GST. Many sole traders and small service providers are not registered.
        </p>
      </div>
      <div>
        <h3 className="font-semibold mb-1">If you're not registered</h3>
        <p className="text-muted-foreground">
          You should not add GST to your invoice. Select "No" if you are not registered.
          Your invoice will be treated as ex-GST.
        </p>
      </div>
      <div>
        <h3 className="font-semibold mb-1">If you're unsure</h3>
        <p className="text-muted-foreground">
          Check with your accountant or financial advisor. Do not guess. Incorrect GST on an
          invoice can cause accounting errors for both parties.
        </p>
      </div>
      <hr />
      <div>
        <h3 className="font-semibold mb-1">How do I know if I'm registered?</h3>
        <ul className="space-y-1 text-muted-foreground">
          <li>• If you've registered with the ATO you'll have a confirmation letter or email.</li>
          <li>• Your BAS (Business Activity Statement) will be issued if you are registered.</li>
          <li>• You can check via the ATO Business Portal.</li>
          <li>• When in doubt, ask your accountant — do not guess.</li>
        </ul>
      </div>
    </>
  );
}

/* ─── Step indicator ─────────────────────────────────────────────────────── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current
              ? 'w-5 bg-primary'
              : i === current
              ? 'w-5 bg-primary/60'
              : 'w-3 bg-muted-foreground/20'
          }`}
        />
      ))}
    </div>
  );
}

/* ─── Section 1: Invoice Review ──────────────────────────────────────────── */
function InvoiceReviewSection({ invoice }: { invoice: DraftInvoice }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Auto-generated from your approved agreement
        </p>
        <h2 className="text-lg font-semibold">Review your invoice</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This invoice has been pre-filled from the commercial terms you approved.
          Please confirm it reflects your agreement.
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Invoice for</p>
              <p className="font-semibold">{invoice.participantName}</p>
              <p className="text-sm text-muted-foreground">{invoice.participantRole}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="text-sm font-medium">{invoice.projectName}</p>
              {invoice.agreementReference && (
                <p className="text-xs text-muted-foreground">{invoice.agreementReference}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">Line items</p>
          {invoice.lineItems.map((item) => (
            <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm">{item.description}</p>
                {item.taxType === 'PENDING' && (
                  <p className="text-xs text-amber-600 mt-0.5">GST to be confirmed</p>
                )}
              </div>
              <p className="text-sm font-medium">{fmt(item.lineTotal, item.currency)}</p>
            </div>
          ))}
        </div>

        <div className="p-4 bg-muted/20 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{fmt(invoice.subtotal, invoice.currency)}</span>
          </div>
          {invoice.gstStatus === 'pending' && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%)</span>
              <span className="text-amber-600 text-xs">Confirmed in next step</span>
            </div>
          )}
          {invoice.gstAmount !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%)</span>
              <span>{fmt(invoice.gstAmount, invoice.currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total</span>
            <span>{fmt(invoice.total, invoice.currency)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          If the amounts or description don't match your agreement, contact the organiser before continuing.
        </p>
      </div>
    </div>
  );
}

/* ─── Section 2: Payment Details ─────────────────────────────────────────── */
type PaymentSectionState = {
  preference: PaymentPreference;
  accountName: string;
  bsb: string;
  accountNumber: string;
  alternativeMethod: string;
};

function PaymentDetailsSection({
  state,
  onChange,
}: {
  state: PaymentSectionState;
  onChange: (s: PaymentSectionState) => void;
}) {
  const bankVal = state.preference === 'bank_account'
    ? validateBankDetails(
        state.accountName || null,
        state.bsb || null,
        state.accountNumber || null
      )
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Where should we send your payment?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your payment will be processed once the event is settled.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Account name</label>
          <input
            type="text"
            value={state.accountName}
            onChange={(e) => onChange({ ...state, accountName: e.target.value })}
            placeholder="Name on bank account"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={state.preference === 'alternative'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">BSB</label>
            <input
              type="text"
              value={state.bsb}
              onChange={(e) => onChange({ ...state, bsb: e.target.value })}
              placeholder="000-000"
              maxLength={7}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={state.preference === 'alternative'}
            />
            {bankVal && !bankVal.bsbValid && state.bsb && (
              <p className="mt-1 text-xs text-red-600">BSB must be 6 digits</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account number</label>
            <input
              type="text"
              value={state.accountNumber}
              onChange={(e) => onChange({ ...state, accountNumber: e.target.value })}
              placeholder="000000000"
              maxLength={9}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={state.preference === 'alternative'}
            />
            {bankVal && !bankVal.accountNumberValid && state.accountNumber && (
              <p className="mt-1 text-xs text-red-600">Must be 6–9 digits</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.preference === 'alternative'}
            onChange={(e) =>
              onChange({
                ...state,
                preference: e.target.checked ? 'alternative' : 'bank_account',
                accountName: e.target.checked ? '' : state.accountName,
                bsb: e.target.checked ? '' : state.bsb,
                accountNumber: e.target.checked ? '' : state.accountNumber,
              })
            }
            className="mt-0.5 h-4 w-4 rounded border-muted-foreground"
          />
          <div>
            <p className="text-sm font-medium">I don't want to be paid into a bank account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select this if you prefer an alternative payment method.
            </p>
          </div>
        </label>

        {state.preference === 'alternative' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Preferred payment method</label>
            <input
              type="text"
              value={state.alternativeMethod}
              onChange={(e) => onChange({ ...state, alternativeMethod: e.target.value })}
              placeholder="e.g. Wise account, USDC wallet, PayPal, Cheque..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              The organiser will review and arrange payment manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section 3: ABN ─────────────────────────────────────────────────────── */
type ABNSectionState = {
  abn: string;
  notApplicable: boolean;
};

function ABNSection({
  state,
  onChange,
}: {
  state: ABNSectionState;
  onChange: (s: ABNSectionState) => void;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const validation = validateABN(state.abn || null, state.notApplicable);
  const hasInput = state.abn.length > 0;
  const showValid = hasInput && validation.isValid;
  const showError = hasInput && !validation.isValid && !state.notApplicable;

  return (
    <div className="space-y-5">
      {drawerOpen && (
        <EducationalDrawer title="About ABN" onClose={() => setDrawerOpen(false)}>
          <ABNEducationalContent />
        </EducationalDrawer>
      )}

      <div>
        <h2 className="text-lg font-semibold">What is your ABN?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your Australian Business Number is required for invoicing.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Australian Business Number (ABN)</label>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            <Info className="h-3 w-3" />
            What is an ABN?
          </button>
        </div>
        <input
          type="text"
          value={state.abn}
          onChange={(e) => onChange({ ...state, abn: e.target.value.replace(/[^\d\s]/g, '') })}
          placeholder="XX XXX XXX XXX"
          maxLength={14}
          disabled={state.notApplicable}
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
            showError ? 'border-red-300 bg-red-50' : 'bg-background'
          }`}
        />

        {showValid && (
          <div className="mt-2 flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              Valid ABN — {validation.formattedABN}
            </span>
          </div>
        )}
        {showError && (
          <div className="mt-2 flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{validation.errorMessage}</span>
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.notApplicable}
            onChange={(e) => onChange({ ...state, notApplicable: e.target.checked, abn: e.target.checked ? '' : state.abn })}
            className="mt-0.5 h-4 w-4 rounded border-muted-foreground"
          />
          <div>
            <p className="text-sm font-medium">I do not have an ABN because it does not apply to my circumstances</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              For example: overseas supplier, foreign contractor, or other exempt situations.
            </p>
          </div>
        </label>
        {state.notApplicable && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              The organiser will need to manually review and confirm before your invoice can be exported to their accounting system.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section 4: GST ─────────────────────────────────────────────────────── */
type GSTSectionState = {
  gstStatus: GSTStatus;
};

function GSTSection({
  state,
  onChange,
  overseasAllowed = false,
}: {
  state: GSTSectionState;
  onChange: (s: GSTSectionState) => void;
  overseasAllowed?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [confirmNotRegistered, setConfirmNotRegistered] = React.useState(false);
  const options: Array<{ value: GSTStatus; label: string; sub: string }> = [
    { value: 'yes', label: 'Yes — I am registered for GST', sub: 'GST will be added to your invoice (10%).' },
    { value: 'no', label: 'No — I am not registered for GST', sub: 'Your invoice will be ex-GST. This is not treated as overseas supplier status.' },
    ...(overseasAllowed
      ? [{ value: 'not_applicable' as GSTStatus, label: 'Overseas supplier — Australian GST not applicable', sub: 'Use only when your tax residency is outside Australia.' }]
      : []),
  ];
  const chooseGstStatus = (value: GSTStatus) => {
    if (value === 'no') {
      setConfirmNotRegistered(true);
      return;
    }
    onChange({ gstStatus: value });
  };

  return (
    <div className="space-y-5">
      {drawerOpen && (
        <EducationalDrawer title="About GST" onClose={() => setDrawerOpen(false)}>
          <GSTEducationalContent />
        </EducationalDrawer>
      )}

      <div>
        <h2 className="text-lg font-semibold">Are you registered for GST?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This determines whether GST is included on your invoice.
        </p>
      </div>

      <div className="space-y-2">
        {options.map(({ value, label, sub }) => (
          <label
            key={value}
            className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
              state.gstStatus === value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <input
              type="radio"
              name="gstStatus"
              value={value}
              checked={state.gstStatus === value}
              onChange={() => chooseGstStatus(value)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="text-xs text-primary flex items-center gap-1 hover:underline"
      >
        <Info className="h-3 w-3" />
        What does GST registration mean?
      </button>

      {state.gstStatus !== 'pending' && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            {state.gstStatus === 'yes'
              ? 'GST (10%) will be added to your invoice. Total will be updated when you submit.'
              : state.gstStatus === 'no'
              ? 'Your invoice will not include GST. This is recorded as Not Registered for GST.'
              : 'The organiser will review your overseas supplier status before processing.'}
          </p>
        </div>
      )}
      {confirmNotRegistered ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-semibold">Confirm GST registration status</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Australian businesses generally need to register for GST once annual GST turnover
                reaches A$75,000, or A$150,000 for non-profit organisations. If you are below the
                threshold and not registered for GST, your invoice should not include GST.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              This will be recorded as <strong>Not Registered for GST</strong>, not as an overseas
              supplier.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setConfirmNotRegistered(false)}
              >
                Go back
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  onChange({ gstStatus: 'no' });
                  setConfirmNotRegistered(false);
                }}
              >
                Confirm not registered
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Section 5: Declaration ─────────────────────────────────────────────── */
type DeclarationState = {
  accepted: boolean;
};

function DeclarationSection({
  state,
  onChange,
  invoice,
}: {
  state: DeclarationState;
  onChange: (s: DeclarationState) => void;
  invoice: DraftInvoice;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Almost done</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Please review and confirm your submission.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Invoice total</span>
          <span className="font-semibold">{fmt(invoice.total, invoice.currency)}</span>
        </div>
        {invoice.gstAmount !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Includes GST</span>
            <span>{fmt(invoice.gstAmount, invoice.currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">GST status</span>
          <span>
            {getSupplierGstTaxTreatment(invoice.gstStatus).displayStatus}
          </span>
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.accepted}
            onChange={(e) => onChange({ accepted: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-muted-foreground"
          />
          <div className="text-sm">
            <p className="font-medium">I confirm that:</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>• My invoice is correct and reflects the commercial agreement I approved.</li>
              <li>• My payment details are accurate and up to date.</li>
              <li>• My ABN and GST information is accurate to the best of my knowledge.</li>
            </ul>
          </div>
        </label>
      </div>
    </div>
  );
}

/* ─── Main Form ──────────────────────────────────────────────────────────── */

export type SupplierOnboardingFormProps = {
  /**
   * Partial input from the platform — agreement, obligation, etc.
   * Form state (payment, ABN, GST) is managed locally and merged on submit.
   */
  baseInput: Omit<SupplierOnboardingInput, 'payment' | 'abn' | 'gst' | 'submission' | 'operator'>;
  /** Called when the supplier submits. Receives the complete merged input. */
  onSubmit: (input: SupplierOnboardingInput) => void;
  /** Loading state from parent. */
  isSubmitting?: boolean;
  /**
   * Optional file upload handler for alternative payment attachments.
   * When provided, the attachment upload area is functional.
   * When absent, a "contact your organiser" message is shown instead.
   */
  onUploadAttachment?: (file: File) => Promise<import('@/lib/commercial/payment-setup-types').PaymentAttachment>;
  /** Existing attachments already uploaded (shown in the payment section). */
  existingAttachments?: import('@/lib/commercial/payment-setup-types').PaymentAttachment[];
};

/**
 * SupplierOnboardingForm
 *
 * The supplier-facing 5-step form.
 * Calculates nothing independently — all validation uses canonical functions.
 */
export function SupplierOnboardingForm({
  baseInput,
  onSubmit,
  isSubmitting = false,
  onUploadAttachment,
  existingAttachments = [],
}: SupplierOnboardingFormProps) {
  const [step, setStep] = React.useState(0);
  const TOTAL_STEPS = 5;

  const [paymentState, setPaymentState] = React.useState<PaymentSectionState>({
    preference: 'bank_account',
    accountName: '',
    bsb: '',
    accountNumber: '',
    alternativeMethod: '',
  });

  const [uploadedAttachments, setUploadedAttachments] = React.useState(existingAttachments);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAttachment) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const attachment = await onUploadAttachment(file);
      setUploadedAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const [abnState, setABNState] = React.useState<ABNSectionState>({
    abn: '',
    notApplicable: false,
  });

  const [gstState, setGSTState] = React.useState<GSTSectionState>({
    gstStatus: 'pending',
  });

  const [declarationState, setDeclarationState] = React.useState<DeclarationState>({
    accepted: false,
  });

  // Build a live invoice preview reflecting current GST selection
  const currentInput: SupplierOnboardingInput = {
    ...baseInput,
    payment: {
      preference: paymentState.preference,
      bankDetails: {
        accountName: paymentState.accountName || null,
        bsb: paymentState.bsb || null,
        accountNumber: paymentState.accountNumber || null,
      },
      alternativePaymentMethod: paymentState.alternativeMethod || null,
    },
    abn: {
      abn: abnState.abn || null,
      abnNotApplicable: abnState.notApplicable,
      abnVerified: validateABN(abnState.abn || null).isValid,
      businessName: null,
    },
    gst: { gstStatus: abnState.notApplicable ? 'not_applicable' : gstState.gstStatus },
    submission: { submittedAt: null, declarationAccepted: false },
    operator: { approvedAt: null, xeroExportedAt: null, notes: null },
  };

  const draftInvoice = generateDraftInvoice(currentInput);

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true; // Invoice review — always can proceed (read-only confirmation)
      case 1: {
        if (paymentState.preference === 'bank_account') {
          const v = validateBankDetails(paymentState.accountName || null, paymentState.bsb || null, paymentState.accountNumber || null);
          return v.isComplete;
        }
        return Boolean(paymentState.alternativeMethod);
      }
      case 2: {
        if (abnState.notApplicable) return true;
        return validateABN(abnState.abn || null).isValid;
      }
      case 3: return abnState.notApplicable || gstState.gstStatus !== 'pending';
      case 4: return declarationState.accepted;
      default: return false;
    }
  };

  const handleSubmit = () => {
    const finalInput: SupplierOnboardingInput = {
      ...currentInput,
      submission: {
        submittedAt: new Date().toISOString(),
        declarationAccepted: declarationState.accepted,
      },
    };
    onSubmit(finalInput);
  };

  const STEP_ICONS = [FileText, CreditCard, Building2, ShieldCheck, ClipboardCheck];
  const STEP_TITLES = ['Invoice', 'Payment', 'ABN', 'GST', 'Confirm'];
  const CurrentIcon = STEP_ICONS[step];

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CurrentIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Step {step + 1} of {TOTAL_STEPS} — {STEP_TITLES[step]}
            </span>
          </div>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>
      </div>

      {/* Section content */}
      <div className="min-h-[360px]">
        {step === 0 && <InvoiceReviewSection invoice={draftInvoice} />}
        {step === 1 && (
          <>
            <PaymentDetailsSection state={paymentState} onChange={setPaymentState} />
            {/* Attachment upload for alternative payment methods */}
            {paymentState.preference === 'alternative' && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium">Supporting attachments</p>
                <p className="text-xs text-muted-foreground">
                  Upload a QR code, wallet screenshot, or payment instructions (JPG, PNG, PDF — max 10 MB each).
                </p>
                {uploadedAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedAttachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span className="text-xs truncate">{att.filename}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {(att.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {onUploadAttachment ? (
                  <label className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/20 transition-colors">
                    <input type="file" className="sr-only" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isUploading} />
                    {isUploading ? 'Uploading…' : '+ Add attachment'}
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    File upload is available when accessing this form via your secure link.
                  </p>
                )}
                {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
              </div>
            )}
          </>
        )}
        {step === 2 && <ABNSection state={abnState} onChange={setABNState} />}
        {step === 3 && (
          <GSTSection
            state={abnState.notApplicable ? { gstStatus: 'not_applicable' } : gstState}
            onChange={setGSTState}
            overseasAllowed={abnState.notApplicable}
          />
        )}
        {step === 4 && <DeclarationSection state={declarationState} onChange={setDeclarationState} invoice={draftInvoice} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            disabled={!canProceed()}
            onClick={() => setStep((s) => s + 1)}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canProceed() || isSubmitting}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Submitting…' : 'Submit payment information'}
            {!isSubmitting && <CheckCircle2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
