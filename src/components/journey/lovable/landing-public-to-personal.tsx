import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

const LAYERS = [
  {
    title: 'Public',
    heading: "What's happening across payments?",
    body: 'Anyone can watch rails, regulation and provider developments.',
  },
  {
    title: 'Context',
    heading: 'What does it mean for this payment?',
    body: 'Search a corridor and Provvy interprets the public routes against your priority.',
  },
  {
    title: 'Personal',
    heading: 'What changes when Provvy knows your business?',
    body: 'Connect bank accounts, payment providers, accounting, invoices, supplier terms, negotiated FX and cash position.',
  },
  {
    title: 'Advisor',
    heading: 'Now Provvy can tell you what you should actually do.',
    body: 'Recommendations stay explainable. You decide what to authorise.',
  },
  {
    title: 'Coordination',
    heading: 'You approve. Provvy coordinates what follows.',
    body: 'The progression is recommend → approve → automate, on your rules.',
  },
] as const;

const CONTROL = [
  'Provvy understands.',
  'Provvy recommends.',
  'Provvy explains why.',
  'You decide what to authorise.',
  'Provvy coordinates what you approved.',
] as const;

export function LandingPublicToPersonal() {
  return (
    <section id="ai-advisor" className="px-6 pb-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
          {LAYERS.map((layer) => (
            <article key={layer.title} className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                {layer.title}
              </p>
              <h3 className="mt-1 text-[14px] font-semibold leading-snug">{layer.heading}</h3>
              <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{layer.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-border/70 bg-card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            You stay in control
          </p>
          <p className="mt-2 max-w-3xl text-[14px]">
            Provvy never silently takes control of money. Discovery is public. Intelligence is
            personalised. Execution is authorised.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
            {CONTROL.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Link href={COMMERCIAL_OS_ROUTES.assessment} className="mt-3 inline-block text-[13px] font-medium text-primary">
            What does this mean for my business? →
          </Link>
        </div>
      </div>
    </section>
  );
}
