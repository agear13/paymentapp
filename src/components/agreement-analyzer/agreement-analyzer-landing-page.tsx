'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import {
  ArrowDown,
  BarChart3,
  Clock,
  FileText,
  ImageIcon,
  Shield,
  Sparkles,
} from 'lucide-react';

import { AgreementAnalyzerUploadForm } from '@/components/agreement-analyzer/agreement-analyzer-upload-form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ProvvypayLegalFooterLinks } from '@/components/legal/provvypay-legal-links';
import { attributionToAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';
import { captureAgreementAnalyzerAttribution } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client';
import { trackAgreementAnalyzerPageViewed } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics';

const SUPPORTED_FORMATS = [
  { label: 'PDF', icon: FileText },
  { label: 'DOCX', icon: FileText },
  { label: 'PNG', icon: ImageIcon },
  { label: 'JPG', icon: ImageIcon },
  { label: 'Screenshots', icon: ImageIcon },
] as const;

const REPORT_PREVIEW_CARDS = [
  {
    title: 'Executive Summary',
    description: 'AI-generated headline, key findings, and operational impact at a glance.',
    accent: 'from-slate-50 to-white',
    preview: (
      <div className="space-y-2 text-xs text-slate-600">
        <p className="font-semibold text-slate-900">Revenue sharing agreement with settlement gaps</p>
        <p>Three parties share ticket revenue with unclear GST treatment and dispute timing.</p>
        <ul className="space-y-1">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-900" />
            GST allocation not defined
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-900" />
            Settlement window ambiguous
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Settlement Simulation',
    description: 'See estimated payouts on a $10,000 AUD revenue scenario.',
    accent: 'from-blue-50/80 to-white',
    preview: (
      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Promoter</span>
          <span className="font-medium text-slate-900">$7,000</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Venue</span>
          <span className="font-medium text-slate-900">$3,000</span>
        </div>
        <div className="mt-2 rounded bg-blue-50 px-2 py-1 text-[10px] text-blue-800">
          Based on $10,000 simulation revenue
        </div>
      </div>
    ),
  },
  {
    title: 'Provvypay Fit Score',
    description: 'Structural fit score based on agreement complexity and revenue-share patterns.',
    accent: 'from-emerald-50/80 to-white',
    preview: (
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-900">72</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Provvypay Fit Score</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          HIGH
        </span>
      </div>
    ),
  },
  {
    title: 'Settlement Risk Assessment',
    description: 'Deterministic risk score with flagged issues and remediation guidance.',
    accent: 'from-amber-50/80 to-white',
    preview: (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            MEDIUM
          </span>
          <span className="text-slate-600">Risk score 48</span>
        </div>
        <p className="text-slate-600">GST treatment and dispute timing may delay settlement.</p>
      </div>
    ),
  },
  {
    title: 'Settlement Readiness Score',
    description: 'Readiness score with factors that should be resolved before payout.',
    accent: 'from-violet-50/80 to-white',
    preview: (
      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-900">65</span>
          <span className="pb-1 text-[10px] text-slate-500">readiness</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[65%] rounded-full bg-violet-500" />
        </div>
      </div>
    ),
  },
] as const;

const FAQ_ITEMS = [
  {
    question: 'What agreements can I upload?',
    answer:
      'Commercial agreements with payment obligations — promoter revenue shares, venue hire, partnership splits, service agreements, and similar contracts. We accept PDF, DOCX, PNG, JPG, and screenshot images.',
  },
  {
    question: 'Is my agreement secure?',
    answer:
      'Yes. Uploads are stored securely and processed only to generate your report. We do not share your agreement with third parties beyond the AI extraction pipeline required to produce the analysis.',
  },
  {
    question: 'How long does analysis take?',
    answer:
      'Most reports are generated in under 60 seconds. You will be redirected to your report page immediately after upload, where you can watch analysis progress in real time.',
  },
  {
    question: 'What happens after upload?',
    answer:
      'We extract parties, revenue splits, obligations, risks, and missing clauses, then generate your full obligation report. You receive a private link to view and share the report, and we email you when it is ready.',
  },
  {
    question: 'Do I need a Provvypay account?',
    answer:
      'No account is required. Upload your agreement with your contact details and receive a free AI-generated obligation report. You can book a demo from the report if you want to explore Provvypay further.',
  },
] as const;

function scrollToUpload() {
  document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function AgreementAnalyzerLandingPage() {
  useEffect(() => {
    const attribution = captureAgreementAnalyzerAttribution();
    trackAgreementAnalyzerPageViewed(attributionToAnalyticsProperties(attribution));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900 hover:text-slate-700">
            Provvypay
          </Link>
          <Button size="sm" onClick={scrollToUpload}>
            Analyze my agreement
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Free AI Agreement Analyzer
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-tight">
              Upload an agreement. Discover where payment disputes could happen.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Receive a free AI-generated obligation report showing revenue splits, payment
              obligations, settlement risks, missing clauses and Provvypay fit.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={scrollToUpload} className="min-w-[220px]">
                Upload your agreement
                <ArrowDown className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-sm text-slate-500">No account required · Free report</p>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {SUPPORTED_FORMATS.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  <Icon className="h-4 w-4 text-slate-500" />
                  {label}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-slate-600">
              <Clock className="mr-1.5 inline h-4 w-4 text-slate-400" />
              Most reports are generated in under 60 seconds.
            </p>
          </div>
        </section>

        <section id="upload" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Upload your agreement
              </h2>
              <p className="mt-2 text-slate-600">
                Enter your details and we&apos;ll generate your obligation report.
              </p>
            </div>
            <AgreementAnalyzerUploadForm />
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50/80 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-500">
                <BarChart3 className="h-4 w-4" />
                What you&apos;ll receive
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                A complete obligation report in minutes
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                Every report includes structured analysis across settlement, risk, and fit — not
                just a text summary.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {REPORT_PREVIEW_CARDS.map((card) => (
                <article
                  key={card.title}
                  className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br ${card.accent} shadow-sm`}
                >
                  <div className="border-b border-slate-200/80 px-5 py-4">
                    <h3 className="font-semibold text-slate-900">{card.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                  </div>
                  <div className="flex flex-1 flex-col justify-between px-5 py-4">
                    <div className="rounded-lg border border-slate-200/80 bg-white/80 p-4">
                      {card.preview}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-500">
                <Shield className="h-4 w-4" />
                FAQ
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Common questions
              </h2>
            </div>

            <Accordion type="single" collapsible className="rounded-xl border border-slate-200 bg-white px-2 shadow-sm">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem key={item.question} value={`faq-${index}`}>
                  <AccordionTrigger className="px-4 text-left text-base font-medium text-slate-900 hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 text-sm leading-relaxed text-slate-600">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-primary px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-primary-foreground">
              Ready to see where disputes could happen?
            </h2>
            <p className="mt-3 text-primary-foreground/80">
              Upload your agreement now and receive your free obligation report.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-6"
              onClick={scrollToUpload}
            >
              Get started
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Provvypay. All rights reserved.
          </p>
          <ProvvypayLegalFooterLinks
            className="flex items-center gap-6"
            linkClassName="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          />
        </div>
      </footer>
    </div>
  );
}
