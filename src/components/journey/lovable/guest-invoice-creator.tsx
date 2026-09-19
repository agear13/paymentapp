'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Building2, CreditCard, Download, FileText, Loader2, User } from 'lucide-react';
import Link from 'next/link';
import { CurrencySelect } from '@/components/payment-links/currency-select';
import {
  ConversationInvoicePastePanel,
  ConversationInvoiceReviewBanners,
  InvoiceCreationMethodToggle,
} from '@/components/journey/lovable/conversation-invoice-paste-panel';
import {
  CREATE_INVOICE_INPUT_CLS,
  CreateInvoiceFieldLabel,
  CreateInvoiceFormCard,
} from '@/components/journey/lovable/create-invoice-ui';
import { GuestInvoicePreview } from '@/components/journey/lovable/guest-invoice-preview';
import { AssessmentProvvyIdentity } from '@/components/journey/lovable/assessment-provvy-identity';
import {
  INVOICE_LANDING_EXAMPLE_CONVERSATION,
  INVOICE_LANDING_TRIAL_CTA_HREF,
  INVOICE_LANDING_TRIAL_CTA_LABEL,
} from '@/lib/journey/invoice-acquisition-landing';
import {
  applyConversationInvoiceExtractionToDraft,
  conversationInvoiceReviewMessages,
  sanitizeConversationInvoiceExtraction,
  type ConversationInvoiceExtraction,
} from '@/lib/invoices/conversation-invoice-extraction';
import {
  applyGuestAdvisorAction,
  buildGuestInvoiceAdvisorView,
  type GuestAdvisorApplyAction,
} from '@/lib/invoices/guest-invoice-advisor';
import {
  conversationGuestInvoiceDraft,
  defaultGuestInvoiceDraft,
  guestInvoiceCanDownload,
  paymentTermsFromExtraction,
  withGuestInvoiceFields,
  type GuestInvoiceDraft,
} from '@/lib/invoices/guest-invoice-draft';
import { downloadGuestInvoicePdf } from '@/lib/invoices/guest-invoice-pdf';

const inputCls = CREATE_INVOICE_INPUT_CLS;

function toDateInputValue(d: Date | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

function parseDateInput(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function GuestInvoiceCreator({
  trialHref = INVOICE_LANDING_TRIAL_CTA_HREF,
  onStartTrial,
}: {
  trialHref?: string;
  onStartTrial?: () => void;
}) {
  const [draft, setDraft] = useState<GuestInvoiceDraft>(() => defaultGuestInvoiceDraft());
  const [creationMethod, setCreationMethod] = useState<'manual' | 'conversation'>('manual');
  const [conversationText, setConversationText] = useState('');
  const [conversationExtraction, setConversationExtraction] =
    useState<ConversationInvoiceExtraction | null>(null);
  const [conversationGenerating, setConversationGenerating] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [appliedActionIds, setAppliedActionIds] = useState<string[]>([]);
  const [advisorDismissed, setAdvisorDismissed] = useState(false);

  const patchDraft = (patch: Partial<GuestInvoiceDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDownloadError(null);
  };

  const handleCreationMethodChange = (method: 'manual' | 'conversation') => {
    setCreationMethod(method);
    setConversationError(null);
    setConversationExtraction(null);
    setAppliedActionIds([]);
    setAdvisorDismissed(false);
    const currency = draft.currency || 'AUD';
    const extras = {
      fromBusinessName: draft.fromBusinessName,
      fromBusinessEmail: draft.fromBusinessEmail,
      paymentTermsNote: '',
    };
    if (method === 'conversation') {
      setDraft({ ...conversationGuestInvoiceDraft(currency), ...extras });
      return;
    }
    setDraft({ ...defaultGuestInvoiceDraft(currency), ...extras });
  };

  const handleConversationGenerate = async () => {
    setConversationError(null);
    setConversationGenerating(true);
    try {
      const response = await fetch('/api/public/invoices/conversation-prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationText }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        extraction?: ConversationInvoiceExtraction;
        error?: string;
      };
      if (!response.ok || !body.extraction) {
        setConversationError(
          body.error || 'Could not extract invoice details. Try again or enter them manually.'
        );
        return;
      }
      const extraction = sanitizeConversationInvoiceExtraction(body.extraction, {
        conversationText,
      });
      setConversationExtraction(extraction);
      setAppliedActionIds([]);
      setAdvisorDismissed(false);
      setDraft((prev) =>
        withGuestInvoiceFields(
          applyConversationInvoiceExtractionToDraft(extraction, prev, { conversationText }),
          {
            fromBusinessName: prev.fromBusinessName,
            fromBusinessEmail: prev.fromBusinessEmail,
            paymentTermsNote: paymentTermsFromExtraction(extraction),
          }
        )
      );
    } catch {
      setConversationError('Could not extract invoice details. Try again or enter them manually.');
    } finally {
      setConversationGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!guestInvoiceCanDownload(draft)) {
      setDownloadError('Add a customer, description and amount before downloading.');
      return;
    }
    downloadGuestInvoicePdf({
      draft,
      taxNote: conversationExtraction?.taxNote,
    });
  };

  const handleApplyInsight = (insightId: string, action: GuestAdvisorApplyAction) => {
    setDraft((current) => applyGuestAdvisorAction(current, action));
    setAppliedActionIds((current) => (current.includes(insightId) ? current : [...current, insightId]));
  };

  const advisor = useMemo(
    () =>
      buildGuestInvoiceAdvisorView({
        draft,
        extraction: conversationExtraction,
        appliedActionIds,
      }),
    [draft, conversationExtraction, appliedActionIds]
  );
  const showPasteOnly = creationMethod === 'conversation' && !conversationExtraction;
  const conversationMessages = conversationExtraction
    ? conversationInvoiceReviewMessages(conversationExtraction)
    : [];

  return (
    <div id="invoice-creator" className="scroll-mt-28">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div className="space-y-6">
          <InvoiceCreationMethodToggle
            method={creationMethod}
            onChange={handleCreationMethodChange}
            manualLabel="Enter details"
            conversationLabel="Paste conversation"
          />
          {showPasteOnly ? (
            <div className="space-y-3">
              <ConversationInvoicePastePanel
                conversationText={conversationText}
                onConversationTextChange={setConversationText}
                onGenerate={handleConversationGenerate}
                generating={conversationGenerating}
                error={conversationError}
                placeholder={INVOICE_LANDING_EXAMPLE_CONVERSATION}
              />
              <button
                type="button"
                onClick={() => setConversationText(INVOICE_LANDING_EXAMPLE_CONVERSATION)}
                className="text-[13px] font-medium text-primary hover:text-foreground"
              >
                Use example conversation
              </button>
            </div>
          ) : null}

          {!showPasteOnly ? (
            <>
              {conversationExtraction ? (
                <ConversationInvoiceReviewBanners
                  extraction={conversationExtraction}
                  messages={conversationMessages}
                />
              ) : null}

              <CreateInvoiceFormCard title="Your business" icon={Building2}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <CreateInvoiceFieldLabel>Business name</CreateInvoiceFieldLabel>
                    <input
                      type="text"
                      value={draft.fromBusinessName}
                      onChange={(event) => patchDraft({ fromBusinessName: event.target.value })}
                      placeholder="Northwind Studio"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Business email</CreateInvoiceFieldLabel>
                    <input
                      type="email"
                      value={draft.fromBusinessEmail}
                      onChange={(event) => patchDraft({ fromBusinessEmail: event.target.value })}
                      placeholder="hello@northwind.test"
                      className={inputCls}
                    />
                  </div>
                </div>
              </CreateInvoiceFormCard>

              <CreateInvoiceFormCard title="Customer" icon={User}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <CreateInvoiceFieldLabel required>Name</CreateInvoiceFieldLabel>
                    <input
                      type="text"
                      value={draft.customerName}
                      onChange={(event) => patchDraft({ customerName: event.target.value })}
                      placeholder="Sarah Chen"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Email</CreateInvoiceFieldLabel>
                    <input
                      type="email"
                      value={draft.customerEmail}
                      onChange={(event) => patchDraft({ customerEmail: event.target.value })}
                      placeholder="sarah@example.com"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Phone</CreateInvoiceFieldLabel>
                    <input
                      type="tel"
                      value={draft.customerPhone}
                      onChange={(event) => patchDraft({ customerPhone: event.target.value })}
                      placeholder="Optional"
                      className={inputCls}
                    />
                  </div>
                </div>
              </CreateInvoiceFormCard>

              <CreateInvoiceFormCard title="Invoice details" icon={FileText}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <CreateInvoiceFieldLabel required>Description</CreateInvoiceFieldLabel>
                    <textarea
                      value={draft.description}
                      onChange={(event) => patchDraft({ description: event.target.value })}
                      placeholder="Campaign delivery"
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Invoice number</CreateInvoiceFieldLabel>
                    <input
                      type="text"
                      value={draft.invoiceReference}
                      onChange={(event) => patchDraft({ invoiceReference: event.target.value })}
                      placeholder="INV-0042"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Issue date</CreateInvoiceFieldLabel>
                    <input
                      type="date"
                      value={toDateInputValue(draft.invoiceDate)}
                      onChange={(event) => {
                        const parsed = parseDateInput(event.target.value);
                        if (parsed) patchDraft({ invoiceDate: parsed });
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Due date</CreateInvoiceFieldLabel>
                    <input
                      type="date"
                      value={toDateInputValue(draft.dueDate)}
                      onChange={(event) => patchDraft({ dueDate: parseDateInput(event.target.value) })}
                      className={inputCls}
                    />
                    {conversationExtraction?.paymentTimingNote && !draft.dueDate ? (
                      <p className="mt-1.5 text-[12px] text-ink-soft">
                        {conversationExtraction.paymentTimingNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <CreateInvoiceFieldLabel>Payment terms</CreateInvoiceFieldLabel>
                    <input
                      type="text"
                      value={draft.paymentTermsNote}
                      onChange={(event) => patchDraft({ paymentTermsNote: event.target.value })}
                      placeholder="Due within 14 days of delivery"
                      className={inputCls}
                    />
                  </div>
                </div>
              </CreateInvoiceFormCard>

              <CreateInvoiceFormCard title="Amount" icon={CreditCard}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <CreateInvoiceFieldLabel required>Amount</CreateInvoiceFieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.amount ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        patchDraft({
                          amount: raw === '' ? undefined : Number.parseFloat(raw),
                        });
                      }}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <CreateInvoiceFieldLabel>Currency</CreateInvoiceFieldLabel>
                    <div className="mt-1.5">
                      <CurrencySelect
                        value={draft.currency}
                        onValueChange={(value) => patchDraft({ currency: value })}
                      />
                    </div>
                  </div>
                </div>
              </CreateInvoiceFormCard>
            </>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <GuestInvoicePreview draft={draft} taxNote={conversationExtraction?.taxNote} />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-testid="guest-invoice-download"
              onClick={handleDownload}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-purple px-5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download invoice PDF
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link
              href={trialHref}
              onClick={onStartTrial}
              data-testid="guest-invoice-payment-link"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-[14px] font-semibold transition-colors hover:bg-accent"
            >
              Create payment link
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="text-center text-[12px] text-ink-soft">
              Download is free and does not require an account. Payment links need a Provvy account.
            </p>
            {downloadError ? (
              <p className="text-center text-[13px] text-destructive" role="alert">
                {downloadError}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {advisor.visible && !advisorDismissed && !showPasteOnly ? (
        <GuestInvoiceAdvisor
          view={advisor}
          trialHref={trialHref}
          onStartTrial={onStartTrial}
          onApply={handleApplyInsight}
          onDismiss={() => setAdvisorDismissed(true)}
        />
      ) : null}

      {conversationGenerating ? (
        <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading the conversation…
        </p>
      ) : null}
    </div>
  );
}

function GuestInvoiceAdvisor({
  view,
  trialHref,
  onStartTrial,
  onApply,
  onDismiss,
}: {
  view: ReturnType<typeof buildGuestInvoiceAdvisorView>;
  trialHref: string;
  onStartTrial?: () => void;
  onApply: (insightId: string, action: GuestAdvisorApplyAction) => void;
  onDismiss: () => void;
}) {
  const primary = view.insights[0];
  return (
    <aside
      data-testid="guest-invoice-advisor"
      className="mt-8 rounded-2xl border border-primary/20 bg-card p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <AssessmentProvvyIdentity supportingLine="Responding to this invoice" />
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1 text-[12px] text-ink-soft hover:bg-accent hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {view.headline}
      </p>
      {primary ? (
        <div className="mt-3 space-y-2">
          <p className="text-[15px] font-semibold tracking-tight">
            {primary.id === 'created' ? "I've created your invoice." : 'One thing I noticed:'}
          </p>
          <p className="text-[14px] leading-relaxed text-foreground">{primary.observation}</p>
          <p className="text-[14px] leading-relaxed text-ink-soft">{primary.recommendation}</p>
          {primary.applyAction && primary.applyLabel ? (
            <button
              type="button"
              onClick={() => onApply(primary.id, primary.applyAction!)}
              className="mt-2 inline-flex min-h-10 items-center rounded-xl border border-border bg-background px-4 text-[13px] font-medium hover:bg-accent"
            >
              {primary.applyLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {view.insights.slice(1).map((insight) => (
        <div key={insight.id} className="mt-4 border-t border-border/60 pt-4">
          <p className="text-[14px] leading-relaxed text-foreground">{insight.observation}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{insight.recommendation}</p>
          {insight.applyAction && insight.applyLabel ? (
            <button
              type="button"
              onClick={() => onApply(insight.id, insight.applyAction!)}
              className="mt-2 inline-flex min-h-10 items-center rounded-xl border border-border bg-background px-4 text-[13px] font-medium hover:bg-accent"
            >
              {insight.applyLabel}
            </button>
          ) : null}
        </div>
      ))}
      <p className="mt-5 text-[13px] leading-relaxed text-ink-soft">{view.unlockCopy}</p>
      <Link
        href={trialHref}
        onClick={onStartTrial}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-purple px-4 text-[13px] font-semibold text-primary-foreground shadow-glow"
      >
        Unlock with Provvy
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      <span className="sr-only">{INVOICE_LANDING_TRIAL_CTA_LABEL}</span>
    </aside>
  );
}
