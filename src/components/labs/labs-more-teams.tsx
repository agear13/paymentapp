import { LABS_MORE_TEAMS } from '@/lib/labs/labs-constants';

export function LabsMoreTeams() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-[42px]">
          More AI Teams. <span className="text-gradient">One Company Brain.</span>
        </h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LABS_MORE_TEAMS.map((t) => {
            const custom = t.tag !== 'Coming Soon';
            return (
              <div
                key={t.name}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-card"
              >
                <div>
                  <div className="text-[15px] font-semibold tracking-tight">{t.name}</div>
                  <div className="mt-1 text-[12.5px] text-ink-soft">
                    {custom
                      ? 'Scoped with the Provvy Labs team.'
                      : 'Not yet available.'}
                  </div>
                </div>
                <span
                  className={
                    custom
                      ? 'shrink-0 rounded-full border border-primary/30 bg-accent px-2.5 py-1 text-[11px] font-medium text-primary'
                      : 'shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-ink-soft'
                  }
                >
                  {t.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
