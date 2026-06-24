'use client';

/**
 * Payment & Tax Information Form
 *
 * Dedicated participant workflow after agreement acceptance.
 * Begins with Agreement Summary, then payment method + tax residency.
 */

import * as React from 'react';
import { ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react';
import { AgreementSummary } from '@/components/commercial/payment-tax/agreement-summary';
import type { AgreementSummaryData } from '@/lib/commercial/participant-commercial-lifecycle';
import type { SupplierOnboardingInput } from '@/lib/commercial/supplier-onboarding';
import { validateABN } from '@/lib/commercial/supplier-onboarding';
import type { PaymentAttachment } from '@/lib/commercial/payment-setup-types';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_TYPES,
  TAX_RESIDENCY_LABELS,
  TAX_RESIDENCY_COUNTRIES,
  type PaymentMethodDetails,
  type PaymentMethodType,
  type TaxResidencyCountry,
  type TaxResidencyDetails,
  isAustralianTaxResidency,
  mapPaymentMethodToSupplierPayment,
  mapTaxToSupplierGst,
} from '@/lib/commercial/payment-tax-types';

type Props = {
  agreementSummary: AgreementSummaryData;
  baseInput: SupplierOnboardingInput;
  onSubmit: (input: SupplierOnboardingInput) => Promise<void>;
  isSubmitting?: boolean;
  onUploadAttachment?: (file: File) => Promise<PaymentAttachment>;
  existingAttachments?: PaymentAttachment[];
};

const STEPS = ['summary', 'payment', 'tax', 'confirm'] as const;
type Step = (typeof STEPS)[number];

function GSTInfoPopover() {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed max-w-sm">
      If you are registered for GST, your invoices generally include GST where applicable. If you
      are not registered, your invoices generally will not include GST. If you are unsure, please
      consult your accountant.
    </div>
  );
}

export function PaymentTaxInformationForm({
  agreementSummary,
  baseInput,
  onSubmit,
  isSubmitting = false,
  onUploadAttachment,
  existingAttachments = [],
}: Props) {
  const [step, setStep] = React.useState<Step>('summary');
  const [payment, setPayment] = React.useState<PaymentMethodDetails>({
    methodType: 'bank_account_australia',
    bankAccountName: baseInput.payment.bankDetails.accountName,
    bankBsb: baseInput.payment.bankDetails.bsb,
    bankAccountNumber: baseInput.payment.bankDetails.accountNumber,
  });
  const [tax, setTax] = React.useState<TaxResidencyDetails>({
    country: 'australia',
    abn: baseInput.abn.abn,
    gstRegistered: baseInput.gst.gstStatus === 'pending' ? null : baseInput.gst.gstStatus,
    taxNotApplicable: baseInput.abn.abnNotApplicable,
  });
  const [declarationAccepted, setDeclarationAccepted] = React.useState(false);
  const [gstInfoOpen, setGstInfoOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [abrLoading, setAbrLoading] = React.useState(false);
  const [abrMessage, setAbrMessage] = React.useState<string | null>(null);
  const [abrVerified, setAbrVerified] = React.useState(false);

  const abnValidation = validateABN(tax.abn ?? null, tax.taxNotApplicable ?? false);
  const isAu = isAustralianTaxResidency(tax.country);

  const lookupAbnLive = React.useCallback(async (abnValue: string) => {
    if (!abnValue.trim()) return;
    setAbrLoading(true);
    setAbrMessage(null);
    try {
      const res = await fetch(
        `/api/commercial/abr-lookup?abn=${encodeURIComponent(abnValue)}`
      );
      const data = await res.json();
      setAbrMessage(data.message ?? null);
      setAbrVerified(Boolean(data.verified));
      if (data.businessName) {
        setTax((t) => ({
          ...t,
          businessName: data.businessName,
          abnVerified: data.verified,
          abnVerificationSource: data.verificationSource,
        }));
      } else {
        setTax((t) => ({
          ...t,
          abnVerified: data.verified,
          abnVerificationSource: data.verificationSource,
        }));
      }
    } catch {
      setAbrMessage('Unable to verify with ABR — format check applied.');
      setAbrVerified(abnValidation.isValid);
    } finally {
      setAbrLoading(false);
    }
  }, [abnValidation.isValid]);

  const stepIndex = STEPS.indexOf(step);
  const canNext =
    step === 'summary' ||
    (step === 'payment' && payment.methodType) ||
    (step === 'tax' &&
      (isAu
        ? Boolean(tax.gstRegistered) && abnValidation.isValid
        : true)) ||
    step === 'confirm';

  const handleSubmit = async () => {
    const mappedPayment = mapPaymentMethodToSupplierPayment(payment);
    const mappedTax = mapTaxToSupplierGst(tax);

    const input: SupplierOnboardingInput = {
      ...baseInput,
      payment: {
        preference: mappedPayment.preference,
        bankDetails: mappedPayment.bankDetails,
        alternativePaymentMethod: mappedPayment.alternativePaymentMethod,
      },
      abn: mappedTax.abnInput,
      gst: { gstStatus: mappedTax.gstStatus },
      submission: {
        submittedAt: new Date().toISOString(),
        declarationAccepted: true,
      },
    };

    await onSubmit(input);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAttachment) return;
    setUploading(true);
    try {
      const attachment = await onUploadAttachment(file);
      setPayment((p) => ({ ...p, qrAttachmentId: attachment.id }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Payment & Tax Information</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete your payment details so your approved earnings can be paid.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 text-xs">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={
              i <= stepIndex
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            }
          >
            {i + 1}. {s === 'summary' ? 'Agreement' : s === 'payment' ? 'Payment' : s === 'tax' ? 'Tax' : 'Confirm'}
          </span>
        ))}
      </div>

      {step === 'summary' && <AgreementSummary summary={agreementSummary} />}

      {step === 'payment' && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-base font-semibold">How would you like to be paid?</h2>
          <p className="text-sm text-muted-foreground">
            Select your preferred payment method. Only the fields required for your choice are shown.
          </p>
          <div className="space-y-2">
            {PAYMENT_METHOD_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={payment.methodType === type}
                  onChange={() => setPayment((p) => ({ ...p, methodType: type }))}
                  className="h-4 w-4"
                />
                <span className="text-sm">{PAYMENT_METHOD_LABELS[type]}</span>
              </label>
            ))}
          </div>

          {payment.methodType === 'bank_account_australia' && (
            <div className="grid gap-3 pt-2">
              <input
                placeholder="Account name"
                value={payment.bankAccountName ?? ''}
                onChange={(e) => setPayment((p) => ({ ...p, bankAccountName: e.target.value }))}
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="BSB"
                  value={payment.bankBsb ?? ''}
                  onChange={(e) => setPayment((p) => ({ ...p, bankBsb: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm"
                />
                <input
                  placeholder="Account number"
                  value={payment.bankAccountNumber ?? ''}
                  onChange={(e) => setPayment((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {payment.methodType === 'wise' && (
            <div className="grid gap-3 pt-2">
              <input
                placeholder="Wise email"
                value={payment.wiseEmail ?? ''}
                onChange={(e) => setPayment((p) => ({ ...p, wiseEmail: e.target.value }))}
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
              <input
                placeholder="Wise account"
                value={payment.wiseAccount ?? ''}
                onChange={(e) => setPayment((p) => ({ ...p, wiseAccount: e.target.value }))}
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
            </div>
          )}

          {payment.methodType === 'revolut' && (
            <input
              placeholder="Revolut username"
              value={payment.revolutUsername ?? ''}
              onChange={(e) => setPayment((p) => ({ ...p, revolutUsername: e.target.value }))}
              className="rounded-md border px-3 py-2 text-sm w-full pt-2"
            />
          )}

          {payment.methodType === 'payid' && (
            <input
              placeholder="PayID"
              value={payment.payId ?? ''}
              onChange={(e) => setPayment((p) => ({ ...p, payId: e.target.value }))}
              className="rounded-md border px-3 py-2 text-sm w-full pt-2"
            />
          )}

          {payment.methodType === 'crypto_wallet' && (
            <div className="grid gap-3 pt-2">
              <input
                placeholder="Network (e.g. Ethereum, Hedera)"
                value={payment.cryptoNetwork ?? ''}
                onChange={(e) => setPayment((p) => ({ ...p, cryptoNetwork: e.target.value }))}
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
              <input
                placeholder="Wallet address"
                value={payment.cryptoWalletAddress ?? ''}
                onChange={(e) => setPayment((p) => ({ ...p, cryptoWalletAddress: e.target.value }))}
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
            </div>
          )}

          {payment.methodType === 'qr_code' && onUploadAttachment && (
            <div className="pt-2 space-y-2">
              <input type="file" accept="image/*" onChange={handleQrUpload} />
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
              {existingAttachments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {existingAttachments.length} file(s) attached
                </p>
              )}
            </div>
          )}

          {payment.methodType === 'other' && (
            <textarea
              placeholder="Describe your preferred payment method"
              value={payment.otherDescription ?? ''}
              onChange={(e) => setPayment((p) => ({ ...p, otherDescription: e.target.value }))}
              className="rounded-md border px-3 py-2 text-sm w-full pt-2 min-h-[80px]"
            />
          )}
        </section>
      )}

      {step === 'tax' && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-base font-semibold">Tax residency</h2>
          <select
            value={tax.country}
            onChange={(e) =>
              setTax((t) => ({ ...t, country: e.target.value as TaxResidencyCountry }))
            }
            className="rounded-md border px-3 py-2 text-sm w-full"
          >
            {TAX_RESIDENCY_COUNTRIES.map((c) => (
              <option key={c} value={c}>{TAX_RESIDENCY_LABELS[c]}</option>
            ))}
          </select>

          {isAu ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">ABN</label>
                <input
                  value={tax.abn ?? ''}
                  onChange={(e) => {
                    setTax((t) => ({ ...t, abn: e.target.value, abnVerified: false }));
                    setAbrVerified(false);
                    setAbrMessage(null);
                  }}
                  onBlur={(e) => void lookupAbnLive(e.target.value)}
                  placeholder="11 digit ABN"
                  className="rounded-md border px-3 py-2 text-sm w-full mt-1"
                />
                {tax.abn && !abnValidation.isValid && (
                  <p className="text-xs text-red-600 mt-1">Invalid ABN — check the number and try again.</p>
                )}
                {abrLoading && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verifying with ABR…
                  </p>
                )}
                {abrMessage && !abrLoading && (
                  <p
                    className={`text-xs mt-1 ${abrVerified ? 'text-green-700' : 'text-muted-foreground'}`}
                  >
                    {abrVerified ? 'Verified' : 'Unable to verify'} — {abrMessage}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Business name</label>
                <input
                  value={tax.businessName ?? ''}
                  onChange={(e) => setTax((t) => ({ ...t, businessName: e.target.value }))}
                  placeholder="Registered business name"
                  className="rounded-md border px-3 py-2 text-sm w-full mt-1"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">GST registered?</label>
                  <button
                    type="button"
                    onClick={() => setGstInfoOpen((o) => !o)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="GST information"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                {gstInfoOpen && <GSTInfoPopover />}
                <div className="flex flex-wrap gap-3 mt-2">
                  {(['yes', 'no', 'not_applicable'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        checked={tax.gstRegistered === v}
                        onChange={() => setTax((t) => ({ ...t, gstRegistered: v }))}
                      />
                      {v === 'not_applicable' ? 'Not Applicable' : v === 'yes' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                placeholder="Business Registration Number (optional)"
                value={tax.businessRegistrationNumber ?? ''}
                onChange={(e) =>
                  setTax((t) => ({ ...t, businessRegistrationNumber: e.target.value }))
                }
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
              <input
                placeholder="Tax Identification Number (optional)"
                value={tax.taxIdentificationNumber ?? ''}
                onChange={(e) =>
                  setTax((t) => ({ ...t, taxIdentificationNumber: e.target.value }))
                }
                className="rounded-md border px-3 py-2 text-sm w-full"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tax.taxNotApplicable ?? false}
                  onChange={(e) => setTax((t) => ({ ...t, taxNotApplicable: e.target.checked }))}
                />
                Not Applicable
              </label>
            </div>
          )}
        </section>
      )}

      {step === 'confirm' && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-base font-semibold">Confirm and submit</h2>
          <p className="text-sm text-muted-foreground">
            Payment method: {PAYMENT_METHOD_LABELS[payment.methodType]}
          </p>
          <p className="text-sm text-muted-foreground">
            Tax residency: {TAX_RESIDENCY_LABELS[tax.country]}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              className="mt-0.5"
            />
            I confirm the payment and tax information provided is accurate.
          </label>
        </section>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          disabled={stepIndex === 0 || isSubmitting}
          onClick={() => setStep(STEPS[stepIndex - 1])}
          className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {step !== 'confirm' ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(STEPS[stepIndex + 1])}
            className="flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!declarationAccepted || isSubmitting}
            onClick={() => void handleSubmit()}
            className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit payment & tax information
          </button>
        )}
      </div>
    </div>
  );
}
