import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/workspace/advisor")({
  component: AdvisorPage,
});

const PROMPTS = [
  "Explain my Commercial Health",
  "Why was this workflow recommended?",
  "What should I improve next?",
  "How can I reduce manual work?",
  "Which customers are slowest to pay?",
  "Forecast next 30 days of cashflow",
];

const CONVERSATION = [
  {
    role: "ai" as const,
    text: "Your Commercial Health is 82 / 100 — Good, improving. The largest gain will come from deploying Autonomous Reconciliation, which addresses 72% of the manual work identified in your assessment.",
  },
  {
    role: "user" as const,
    text: "Why did you recommend Autonomous Reconciliation first?",
  },
  {
    role: "ai" as const,
    text: "Three signals: your accounting volume in Xero, the manual reconciliation time recorded during assessment, and the fact that Pinch Payments is already connected. This workflow removes the highest-frequency, lowest-value task in your commercial operation.",
  },
];

function AdvisorPage() {
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
            {CONVERSATION.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-purple text-primary-foreground shadow-glow"
                      : "border border-border bg-background text-foreground"
                  }`}
                >
                  {m.role === "ai" && (
                    <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
                      <Sparkles className="h-3 w-3" />
                      Provvy AI
                    </div>
                  )}
                  <div>{m.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <input
              readOnly
              placeholder="Ask Provvy AI…"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-soft"
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-purple px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Suggested prompts
        </div>
        {PROMPTS.map((p) => (
          <button
            key={p}
            className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-[13px] font-medium text-foreground shadow-card transition-colors hover:border-primary/40 hover:bg-accent"
          >
            {p}
            <ArrowRight className="h-3.5 w-3.5 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </aside>
    </div>
  );
}
