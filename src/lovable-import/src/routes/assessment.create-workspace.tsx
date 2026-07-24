import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Mail, Sparkles, Workflow } from "lucide-react";

export const Route = createFileRoute("/assessment/create-workspace")({
  component: CreateWorkspaceScreen,
});

function CreateWorkspaceScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const proceed = () => navigate({ to: "/assessment/provisioning" });

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <Link to="/assessment/recommendation" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[12px] text-ink-soft shadow-soft">
            <Sparkles className="h-3 w-3 text-primary" />
            Ready to deploy
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Your Commercial OS is ready.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-ink-soft">
            Create a workspace to save your recommendation and deploy Autonomous Reconciliation across your business.
          </p>

          <div className="mt-8 space-y-2.5">
            {[
              "Save your tailored recommendation",
              "Invite your team when you're ready",
              "Deploy workflows on your systems",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5 text-[13.5px] text-foreground">
                <div className="grid h-4 w-4 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-2.5 w-2.5" />
                </div>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">Create your workspace</div>
              <div className="text-[12px] text-ink-soft">Free while in early access</div>
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <SsoButton onClick={proceed} provider="Google" />
            <SsoButton onClick={proceed} provider="Microsoft" />
          </div>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-soft">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <label className="text-[12px] font-medium text-foreground">Work email</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Mail className="h-4 w-4 text-ink-soft" />
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-ink-soft"
            />
          </div>
          <button
            onClick={proceed}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.01]"
          >
            Continue with email <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <div className="mt-5 text-center text-[11px] text-ink-soft">
            By continuing you agree to Provvy's terms and privacy policy.
          </div>
        </div>
      </div>
    </section>
  );
}

function SsoButton({ provider, onClick }: { provider: "Google" | "Microsoft"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-background px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:bg-accent"
    >
      <ProviderMark provider={provider} />
      Continue with {provider}
    </button>
  );
}

function ProviderMark({ provider }: { provider: "Google" | "Microsoft" }) {
  if (provider === "Google") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.2 1.3-1 2.4-2.1 3.2v2.6h3.4c2-1.9 3.1-4.6 3.1-7.6z" />
        <path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7C4.4 19.8 8 22 12 22z" />
        <path fill="#FBBC05" d="M6.2 13.6c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V6.9H2.7C2 8.4 1.6 10.2 1.6 12s.4 3.6 1.1 5.1l3.5-2.7z" />
        <path fill="#EA4335" d="M12 5.7c1.5 0 2.9.5 4 1.5l3-3C17.2 2.4 14.8 1.4 12 1.4 8 1.4 4.4 3.6 2.7 6.9l3.5 2.7C7 7.5 9.3 5.7 12 5.7z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}
