import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Moon,
  Sun,
  LayoutGrid,
  Workflow,
  Activity,
  Plug,
  Sparkles,
  Settings,
} from "lucide-react";
import provvyLogo from "@/assets/provvy-logo.png.asset.json";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Commercial Workspace — Provvy" },
      {
        name: "description",
        content:
          "Your personalised Commercial Operating System. Deploy workflows, monitor commercial health and let Provvy AI operate alongside you.",
      },
      { property: "og:title", content: "Commercial Workspace — Provvy" },
      {
        property: "og:description",
        content:
          "The authenticated Commercial Operating System — workflows, timeline and AI advisor for your business.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspaceLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/workspace", label: "Workspace", icon: LayoutGrid, exact: true },
  { to: "/workspace/workflows", label: "Workflows", icon: Workflow },
  { to: "/workspace/timeline", label: "Timeline", icon: Activity },
  { to: "/workspace/connected", label: "Connected Systems", icon: Plug },
  { to: "/workspace/advisor", label: "AI Advisor", icon: Sparkles },
  { to: "/workspace/settings", label: "Settings", icon: Settings },
];

function WorkspaceLayout() {
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

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[400px]"
        style={{ background: "var(--gradient-hero)" }}
      />
      <header className="sticky top-4 z-50 mx-auto w-[min(1280px,calc(100%-2rem))] rounded-2xl glass px-4 py-2.5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/workspace" className="flex items-center gap-2">
              <img src={provvyLogo.url} alt="Provvy" className="h-7 w-7 object-contain" />
              <span className="text-[15px] font-semibold tracking-tight">Provvy</span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.to
                  : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-ink-soft hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-[12px] text-ink-soft sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Operational
            </div>
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-purple text-[12px] font-semibold text-primary-foreground">
              A
            </div>
          </div>
        </div>
        <nav className="mt-2 flex items-center gap-1 overflow-x-auto lg:hidden">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-ink-soft hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="relative mx-auto w-[min(1280px,calc(100%-2rem))] py-8">
        <Outlet />
      </main>
    </div>
  );
}
