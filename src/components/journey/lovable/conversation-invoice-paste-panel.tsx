'use client';

import { Loader2, MessageSquareText } from 'lucide-react';
import {
  CONVERSATION_INVOICE_MAX_CHARS,
  type ConversationInvoiceExtraction,
} from '@/lib/invoices/conversation-invoice-extraction';
import { CREATE_INVOICE_INPUT_CLS } from '@/components/journey/lovable/create-invoice-ui';

export function InvoiceCreationMethodToggle({
  method,
  onChange,
}: {
  method: 'manual' | 'conversation';
  onChange: (method: 'manual' | 'conversation') => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        Invoice creation method
      </p>
    <div
      data-testid="invoice-creation-method-toggle"
      className="inline-flex rounded-xl border border-border bg-secondary/60 p-1"
      role="tablist"
      aria-label="Invoice creation method"
    >
      <button
        type="button"
        role="tab"
        aria-selected={method === 'manual'}
        onClick={() => onChange('manual')}
        className={`h-9 rounded-lg px-4 text-[13px] font-medium transition-colors ${
          method === 'manual'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-ink-soft hover:text-foreground'
        }`}
      >
        Create manually
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={method === 'conversation'}
        data-testid="invoice-creation-method-conversation"
        onClick={() => onChange('conversation')}
        className={`h-9 rounded-lg px-4 text-[13px] font-medium transition-colors ${
          method === 'conversation'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-ink-soft hover:text-foreground'
        }`}
      >
        Paste conversation
      </button>
    </div>
    </div>
  );
}

export function ConversationInvoicePastePanel({
  conversationText,
  onConversationTextChange,
  onGenerate,
  generating,
  error,
}: {
  conversationText: string;
  onConversationTextChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}) {
  const count = conversationText.length;
  const overLimit = count > CONVERSATION_INVOICE_MAX_CHARS;

  return (
    <section
      data-testid="conversation-invoice-paste-panel"
      className="rounded-2xl border border-border bg-card p-6 shadow-card"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Turn a conversation into an invoice</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            Paste a WhatsApp, Slack, email, or other conversation. Provvy will extract the invoice
            details it can identify and let you review everything before creating the invoice.
          </p>
        </div>
      </div>
      <textarea
        value={conversationText}
        onChange={(e) => onConversationTextChange(e.target.value)}
        placeholder={`Client: Can you invoice us $5,000 for the event production work?\n\nYou: Yes — I'll send the invoice this week.`}
        rows={12}
        className={`${CREATE_INVOICE_INPUT_CLS} mt-0 min-h-[220px] resize-y`}
        disabled={generating}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-[12px] ${overLimit ? 'text-destructive' : 'text-ink-soft'}`}>
          Characters: {count.toLocaleString()} / {CONVERSATION_INVOICE_MAX_CHARS.toLocaleString()}
        </p>
        <button
          type="button"
          data-testid="conversation-invoice-generate"
          disabled={generating || !conversationText.trim() || overLimit}
          onClick={onGenerate}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Generate invoice draft
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-[13px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function ConversationInvoiceReviewBanners({
  extraction,
  messages,
}: {
  extraction: ConversationInvoiceExtraction;
  messages: string[];
}) {
  return (
    <div data-testid="conversation-invoice-review-banners" className="space-y-2">
      <div className="rounded-2xl border border-primary/20 bg-accent/60 px-4 py-3.5 text-[13.5px] text-foreground">
        <p className="font-semibold tracking-tight">Invoice draft prepared</p>
        <p className="mt-1 text-ink-soft">
          Review and edit every field before you create the invoice. Provvy only filled details it
          could identify clearly.
        </p>
      </div>
      {messages.map((message) => (
        <p
          key={message}
          className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300"
        >
          {message}
        </p>
      ))}
      {extraction.candidates.filter((c) => c.kind === 'amount').length > 1 ? (
        <p className="text-[12.5px] text-ink-soft">
          Possible amounts:{' '}
          {extraction.candidates
            .filter((c) => c.kind === 'amount')
            .map((c) => c.label)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
