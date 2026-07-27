'use client';

import { useState } from 'react';
import { Sparkles, Send, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const PROMPTS = [
  'Explain my Commercial Health',
  'Why was this workflow recommended?',
  'What should I improve next?',
  'How can I reduce manual work?',
  'Which customers are slowest to pay?',
  'Forecast next 30 days of cashflow',
];

const CONVERSATION = [
  {
    role: 'ai' as const,
    text: 'Your Commercial Health is 82 / 100 — Good, improving. The largest gain will come from deploying Autonomous Reconciliation, which addresses 72% of the manual work identified in your assessment.',
  },
  {
    role: 'user' as const,
    text: 'Why did you recommend Autonomous Reconciliation first?',
  },
  {
    role: 'ai' as const,
    text: 'Three signals: your accounting volume in Xero, the manual reconciliation time recorded during assessment, and the fact that Pinch Payments is already connected. This workflow removes the highest-frequency, lowest-value task in your commercial operation.',
  },
];

export function WorkspaceAdvisorScreen() {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(CONVERSATION);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { role: 'user' as const, text: trimmed },
      {
        role: 'ai' as const,
        text: 'I am analysing your connected systems, agreements and workflow history to answer that. For this workspace preview, continue with Autonomous Reconciliation to see grounded recommendations in action.',
      },
    ]);
    setDraft('');
  };

  return (
    <div className="animate-fade-up grid gap-6 pb-16 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <header>
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-purple px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            AI Advisor
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Your operating partner.
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
            Grounded in your business — not a chatbot. Ask Provvy anything about how your commercial operation is performing.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-gradient-purple text-primary-foreground shadow-glow'
                      : 'border border-border bg-background text-foreground'
                  }`}
                >
                  {message.role === 'ai' && (
                    <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
                      <Sparkles className="h-3 w-3" />
                      Provvy AI
                    </div>
                  )}
                  <div>{message.text}</div>
                </div>
              </div>
            ))}
          </div>

          <form
            className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Provvy AI…"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-soft"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-purple px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </form>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Suggested prompts
        </div>
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-[13px] font-medium text-foreground shadow-card transition-colors hover:border-primary/40 hover:bg-accent"
          >
            {prompt}
            <ArrowRight className="h-3.5 w-3.5 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </aside>
    </div>
  );
}
