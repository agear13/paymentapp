import Link from 'next/link';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { LABS_CALENDLY_URL, LABS_WORKFLOWS_HREF } from '@/lib/labs/labs-constants';

export function LabsFooter() {
  return (
    <footer className="mt-8 border-t border-border/60 px-6 py-14">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <ProvvypayLogoMark href="" showWordmark={false} size="sm" className="shrink-0 [&>div]:h-7 [&>div]:w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Provvy Labs</span>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-[13px] text-ink-soft">
          <Link href="/journey" className="transition-colors hover:text-foreground">
            Provvy Home
          </Link>
          <Link href={LABS_WORKFLOWS_HREF} className="transition-colors hover:text-foreground">
            Workflows
          </Link>
          <a
            href={LABS_CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Talk to Provvy Labs
          </a>
        </div>
        <div className="text-[12px] text-ink-soft">
          © {new Date().getFullYear()} Provvy. Productised AI implementation.
        </div>
      </div>
    </footer>
  );
}
