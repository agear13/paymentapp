'use client';

import {
  isDetailedHoldingAccountGuide,
  XERO_GUIDE_FIELD_CLASSIFICATION_LABELS,
  type XeroCreateAccountInXeroGuide,
  type XeroCreateAccountField,
  type XeroGuideFieldClassification,
} from '@/lib/xero/xero-holding-account-guides';
import type { XERO_CREATE_ACCOUNT_IN_XERO_GUIDE } from '@/lib/xero/xero-holding-account-guides';

type GuideInput =
  | XeroCreateAccountInXeroGuide
  | typeof XERO_CREATE_ACCOUNT_IN_XERO_GUIDE;

function classificationTone(classification: XeroGuideFieldClassification): string {
  switch (classification) {
    case 'required_for_provvvy':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'recommended':
      return 'text-primary';
    case 'do_not_enable':
      return 'text-amber-800 dark:text-amber-300';
    case 'confirm_with_accountant':
      return 'text-muted-foreground';
  }
}

function CreateFieldRow({ field }: { field: XeroCreateAccountField }) {
  const classificationLabel = XERO_GUIDE_FIELD_CLASSIFICATION_LABELS[field.classification];

  return (
    <li className="space-y-0.5">
      <div>
        <span className="font-medium text-foreground">{field.label}:</span>{' '}
        <span>{field.value}</span>
      </div>
      <p className={`text-xs ${classificationTone(field.classification)}`}>
        {classificationLabel}
      </p>
    </li>
  );
}

export function CreateAccountInXeroGuidePanel({
  guide,
  suggestedCode,
}: {
  guide: GuideInput;
  suggestedCode: string;
}) {
  const detailed = isDetailedHoldingAccountGuide(guide);

  return (
    <details className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-foreground">{guide.title}</summary>

      {detailed ? (
        <p className="mt-3 text-muted-foreground">
          <span className="font-medium text-foreground">When you need this:</span>{' '}
          {guide.whenYouNeedThis}
        </p>
      ) : null}

      <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
        {guide.steps.map((step, index) => (
          <li key={step}>
            {step.replace('{code}', suggestedCode)}
            {detailed && index === guide.steps.length - 1 ? (
              <ul className="mt-2 list-none space-y-3 pl-0">
                {guide.createFields.map((field) => (
                  <CreateFieldRow key={field.label} field={field} />
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {detailed
          ? guide.closingSteps.map((step) => <li key={step}>{step}</li>)
          : null}
      </ol>

      {detailed ? (
        <>
          <details className="mt-3 rounded-md border border-border/60 bg-background/60 px-3 py-2">
            <summary className="cursor-pointer font-medium text-foreground">
              {guide.whySettings.title}
            </summary>
            <p className="mt-2 text-muted-foreground">{guide.whySettings.body}</p>
            {guide.whySettings.taxClarification ? (
              <p className="mt-2 text-muted-foreground">{guide.whySettings.taxClarification}</p>
            ) : null}
          </details>

          <details className="mt-3 rounded-md border border-border/60 bg-background/60 px-3 py-2">
            <summary className="cursor-pointer font-medium text-foreground">
              {guide.accountingNote.title}
            </summary>
            <p className="mt-2 text-muted-foreground">{guide.accountingNote.body}</p>
          </details>
        </>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">{guide.afterCreate}</p>
    </details>
  );
}
