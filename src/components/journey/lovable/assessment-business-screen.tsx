'use client';

import Link from 'next/link';
import {
  persistJourneyBusiness,
  readJourneyAssessment,
} from '@/lib/journey/journey-assessment-storage.client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const INDUSTRIES = [
  'Professional services',
  'E-commerce',
  'SaaS / Technology',
  'Construction / Trades',
  'Hospitality',
  'Healthcare',
  'Other',
];
const ACCOUNTING = ['Xero', 'MYOB', 'QuickBooks', 'NetSuite', 'None / Spreadsheets'];
const MANUAL_RECONCILIATION = 'Manual reconciliation';

export function AssessmentBusinessScreen() {
  const router = useRouter();
  const initial = useMemo(() => readJourneyAssessment(), []);
  const [industry, setIndustry] = useState(initial.business?.industry ?? '');
  const [accounting, setAccounting] = useState(initial.business?.accounting ?? '');
  const [manualReconciliation, setManualReconciliation] = useState(
    initial.business?.challenge === MANUAL_RECONCILIATION
  );

  const showReconciliationChip = initial.objective === 'reduce-admin' && accounting === 'Xero';

  const handleContinue = () => {
    persistJourneyBusiness({
      industry: industry || undefined,
      accounting: accounting || undefined,
      challenge: showReconciliationChip && manualReconciliation ? MANUAL_RECONCILIATION : undefined,
    });
    router.push('/journey/provisioning');
  };

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/journey/assessment"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Help us understand your current setup
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink-soft">
          Optional. Skip anything that doesn&apos;t apply — you don&apos;t need accounting software
          or connected systems to continue.
        </p>

        <div className="mt-10 space-y-8">
          <Field label="Industry">
            <Chips options={INDUSTRIES} value={industry} onChange={setIndustry} />
          </Field>
          <Field label="Accounting software">
            <Chips options={ACCOUNTING} value={accounting} onChange={setAccounting} />
          </Field>
          {showReconciliationChip ? (
            <Field label="Is this part of the work?">
              <button
                type="button"
                onClick={() => setManualReconciliation((current) => !current)}
                className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all ${
                  manualReconciliation
                    ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent'
                }`}
              >
                Manual reconciliation is a big part of the work
              </button>
            </Field>
          ) : null}
        </div>

        <div className="mt-12 flex items-center justify-end">
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-3 block text-[13px] font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(active ? '' : option)}
            className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all ${
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
