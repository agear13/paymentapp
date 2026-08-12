import { LABS_CAMPAIGN_OUTPUTS } from '@/lib/labs/labs-constants';

export function LabsCampaignOutputs() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-[42px]">
          What a campaign <span className="text-gradient">can produce</span>
        </h2>
        <p className="mt-5 max-w-2xl text-[15.5px] text-ink-soft">
          Outputs vary according to the campaign brief. Your brief and business context determine
          what the AI Marketing Team produces.
        </p>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LABS_CAMPAIGN_OUTPUTS.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="group rounded-2xl border border-border/60 bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-gradient-purple group-hover:text-primary-foreground">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="mt-10 text-[15.5px] font-semibold tracking-tight">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
