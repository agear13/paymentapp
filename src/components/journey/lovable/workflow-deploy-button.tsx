'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type WorkflowDeployButtonProps = {
  templateSlug: string;
  installed: boolean;
  instanceHref: string;
  onDeployed?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
};

export function WorkflowDeployButton({
  templateSlug,
  installed,
  instanceHref,
  onDeployed,
  className = '',
  variant = 'primary',
}: WorkflowDeployButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (installed) {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
          Added to Workspace
        </span>
        <a
          href={instanceHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-purple px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
        >
          Open Workflow
        </a>
      </div>
    );
  }

  const handleDeploy = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/workflows/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateSlug }),
      });
      const data = (await res.json()) as { error?: string; workflow?: unknown };
      if (!res.ok) {
        setMessage(data.error ?? 'Deployment failed');
        return;
      }
      onDeployed?.();
    } catch {
      setMessage('Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  const btnClass =
    variant === 'primary'
      ? 'rounded-xl bg-gradient-purple px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow'
      : 'rounded-xl border border-border bg-background px-5 py-2.5 text-[13px] font-medium text-foreground';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleDeploy()}
        disabled={loading}
        className={`inline-flex items-center gap-2 ${btnClass} disabled:opacity-60`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Add to Workspace
      </button>
      {message ? <p className="mt-2 text-[12px] text-red-600">{message}</p> : null}
    </div>
  );
}
