import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import provvyLogo from "@/assets/provvy-logo.png.asset.json";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "Commercial Assessment — Provvy" },
      {
        name: "description",
        content:
          "Provvy AI analyses your business and recommends the right commercial workflow to deploy.",
      },
      { property: "og:title", content: "Commercial Assessment — Provvy" },
      {
        property: "og:description",
        content:
          "Answer a few questions and let Provvy AI design your Commercial Operating System.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssessmentLayout,
});

const STEPS = [
  { path: "/assessment", label: "Objective" },
  { path: "/assessment/business", label: "Business" },
  { path: "/assessment/connect", label: "Connect" },
  { path: "/assessment/analysis", label: "Analysis" },
  { path: "/assessment/recommendation", label: "Recommendation" },
  { path: "/assessment/create-workspace", label: "Workspace" },
  { path: "/assessment/provisioning", label: "Provisioning" },
];

function AssessmentLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const currentIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.path === pathname),
  );
  const progress = ((currentIndex + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px]"
        style={{ background: "var(--gradient-hero)" }}
      />
      <header className="sticky top-4 z-50 mx-auto w-[min(1200px,calc(100%-2rem))] rounded-2xl glass px-5 py-3 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={provvyLogo.url} alt="Provvy" className="h-7 w-7 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight">Provvy</span>
          </Link>
          <div className="hidden flex-1 items-center gap-3 md:flex">
            <div className="text-[12px] text-ink-soft">
              Step {currentIndex + 1} of {STEPS.length} · {STEPS[currentIndex]?.label}
            </div>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Exit
            </Link>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 md:hidden">
          <div className="text-[11px] text-ink-soft whitespace-nowrap">
            {currentIndex + 1}/{STEPS.length}
          </div>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      <main className="relative">
        <Outlet />
      </main>
    </div>
  );
}
