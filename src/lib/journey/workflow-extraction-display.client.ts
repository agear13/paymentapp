'use client';

import {
  buildExtractionReadiness,
  type ExtractionReadinessAssessment,
  type ReadinessDimension,
} from '@/lib/ai-extractor/extraction-readiness';
import type { ExtractedParty, ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  hasFixedFeeAmount,
  hasRevenueSharePct,
  isHybridExtractedParty,
} from '@/lib/ai-extractor/party-obligation-metrics';
import {
  PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT,
  paymentTermIsLinkedToParty,
} from '@/lib/ai-extractor/party-linked-settlement';
import {
  buildSettlementSchedule,
  type SettlementScheduleLine,
} from '@/lib/ai-extractor/settlement-schedule';
import { resolveWorkflowAgreementCurrency } from '@/lib/journey/workflow-agreement-currency.client';

export type WorkflowJourneyStage =
  | 'agreement'
  | 'extraction'
  | 'review'
  | 'approvals'
  | 'collection'
  | 'settlement'
  | 'complete';

export type WorkflowPaymentScheduleRow = {
  key: string;
  title: string;
  amountLabel: string | null;
  trigger: string | null;
  participant: string | null;
  phase: PaymentSchedulePhase;
  stepNumber: number;
  stepLabel: string;
};

export type PaymentSchedulePhase = 'deposit' | 'milestone' | 'final' | 'other';

export type WorkflowExecutiveSummary = {
  tagline: string;
  narrative: string;
  highlights: Array<{ label: string; detail: string }>;
};

export type WorkflowExtractionInsightRow = {
  label: string;
  detail: string;
};

export type WorkflowReadinessDisplay = {
  score: number;
  label: string;
  summary: string;
  /** When false, UI shows the label as status text instead of a percentage badge. */
  showProgressScore?: boolean;
};

function termText(term: {
  description: { value: string | null };
  dueCondition: { value: string | null };
}): string {
  return `${term.description.value ?? ''} ${term.dueCondition.value ?? ''}`.trim();
}

function paymentTermsLookLikePercentages(
  terms: NonNullable<ExtractionResult['paymentTerms']>,
): boolean {
  const amounts = terms
    .map((term) => term.amount.value)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (amounts.length < 2) return false;
  const sum = amounts.reduce((total, value) => total + value, 0);
  return sum >= 95 && sum <= 105 && amounts.every((value) => value <= 100);
}

function inferPaymentPhase(title: string, index: number, total: number): PaymentSchedulePhase {
  const normalized = title.toLowerCase();
  if (/deposit/.test(normalized)) return 'deposit';
  if (/milestone/.test(normalized)) return 'milestone';
  if (/final settlement|final/.test(normalized)) return 'final';
  if (index === 0 && total >= 2) return 'deposit';
  if (index === total - 1 && total >= 2) return 'final';
  if (total >= 3 && index === 1) return 'milestone';
  return 'other';
}

function phaseStepLabel(phase: PaymentSchedulePhase): string {
  switch (phase) {
    case 'deposit':
      return 'Deposit';
    case 'milestone':
      return 'Milestone Payment';
    case 'final':
      return 'Final Settlement';
    default:
      return 'Payment';
  }
}

function attachSchedulePresentation(
  row: Omit<WorkflowPaymentScheduleRow, 'phase' | 'stepNumber' | 'stepLabel'>,
  index: number,
  total: number,
): WorkflowPaymentScheduleRow {
  const phase = inferPaymentPhase(row.title, index, total);
  return {
    ...row,
    phase,
    stepNumber: index + 1,
    stepLabel: phaseStepLabel(phase),
  };
}

function participantRoleSummary(result: ExtractionResult): string {
  const names = result.parties
    .map((party) => party.name.value?.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (names.length === 0) return 'the commercial parties';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function describePaymentStructure(
  scheduleRows: WorkflowPaymentScheduleRow[],
): string | null {
  const phases = scheduleRows.map((row) => row.phase).filter((phase) => phase !== 'other');
  if (phases.includes('deposit') && phases.includes('milestone') && phases.includes('final')) {
    return 'a deposit, milestone release, and final settlement';
  }
  if (phases.includes('deposit') && phases.includes('final')) {
    return 'staged payments with an upfront deposit and final settlement';
  }
  if (scheduleRows.length >= 2) {
    return `${scheduleRows.length} scheduled payment releases`;
  }
  if (scheduleRows.length === 1) {
    return 'a single settlement event';
  }
  return null;
}

export function buildWorkflowPremiumOneLiner(input: {
  result: ExtractionResult;
  dealName: string;
  formatMoney: (amount: number) => string;
}): string {
  const { result, dealName, formatMoney } = input;
  const agreementName = result.projectName.value?.trim() || dealName.trim() || 'This agreement';
  const scheduleRows = buildWorkflowPaymentScheduleRows(result, formatMoney);
  const paymentStructure = describePaymentStructure(scheduleRows);
  const partyCount = result.parties.length;
  const projectValue = result.projectValue.value;

  if (paymentStructure && partyCount > 0) {
    return `Provvy has translated ${agreementName} into executable commercial logic — ${paymentStructure} across ${partyCount} participant${partyCount === 1 ? '' : 's'}, ready to run before accounting.`;
  }

  if (typeof projectValue === 'number' && projectValue > 0 && partyCount > 0) {
    return `Provvy understands who gets paid, when money moves, and what must happen first — structuring ${agreementName} for autonomous settlement, not manual reconciliation.`;
  }

  if (partyCount > 0) {
    return `Provvy has mapped the commercial relationship behind ${agreementName} — participants, obligations, and settlement conditions — from unstructured agreement text.`;
  }

  return 'Provvy turns agreement conversations into structured commercial logic your business can execute.';
}

export function buildWorkflowExecutiveSummary(input: {
  result: ExtractionResult;
  dealName: string;
  formatMoney: (amount: number) => string;
}): WorkflowExecutiveSummary {
  const { result, dealName, formatMoney } = input;
  const agreementName = result.projectName.value?.trim() || dealName.trim() || 'This commercial agreement';
  const scheduleRows = buildWorkflowPaymentScheduleRows(result, formatMoney);
  const partyCount = result.parties.length;
  const partySummary = participantRoleSummary(result);
  const paymentStructure = describePaymentStructure(scheduleRows);
  const projectValue = result.projectValue.value;
  const readiness = result.readinessAssessment ?? buildExtractionReadiness(result);
  const uncertaintyCount = result.uncertainties.length;

  const valuePhrase =
    typeof projectValue === 'number' && projectValue > 0
      ? ` with ${formatMoney(projectValue)} in commercial value`
      : '';

  let narrative = `${agreementName} brings together ${partySummary}${valuePhrase}. `;
  if (paymentStructure) {
    narrative += `Provvy identified ${paymentStructure}, linked to explicit release conditions rather than inferred accounting rules. `;
  } else if (partyCount > 0) {
    narrative += `Provvy mapped participant roles, compensation logic, and the operational obligations that gate payment release. `;
  }
  if (uncertaintyCount > 0) {
    narrative += `${uncertaintyCount} commercial ambiguit${uncertaintyCount === 1 ? 'y was' : 'ies were'} flagged for human review — the system surfaces uncertainty instead of guessing.`;
  } else {
    narrative += 'The extracted structure is ready for participant review and workflow deployment.';
  }

  const highlights: WorkflowExecutiveSummary['highlights'] = [
    {
      label: 'Commercial parties',
      detail:
        partyCount > 0
          ? `${partyCount} participant${partyCount === 1 ? '' : 's'} with roles and obligations identified`
          : 'Participant mapping requires review',
    },
    {
      label: 'Payment structure',
      detail:
        paymentStructure ??
        (scheduleRows.length > 0
          ? `${scheduleRows.length} settlement event${scheduleRows.length === 1 ? '' : 's'} extracted`
          : 'Payment timing to be confirmed in review'),
    },
    {
      label: 'Settlement readiness',
      detail: readiness.summary.replace(/^Settlement not ready today: /i, '').replace(/\.$/, ''),
    },
  ];

  if (uncertaintyCount > 0) {
    highlights.push({
      label: 'Open questions',
      detail: `${uncertaintyCount} item${uncertaintyCount === 1 ? '' : 's'} flagged — review before deployment`,
    });
  }

  return {
    tagline: buildWorkflowPremiumOneLiner(input),
    narrative,
    highlights,
  };
}

export function buildWorkflowExtractionInsightRows(
  result: ExtractionResult,
  formatMoney: (amount: number) => string,
): WorkflowExtractionInsightRow[] {
  const readiness = result.readinessAssessment ?? buildExtractionReadiness(result);
  const scheduleRows = buildWorkflowPaymentScheduleRows(result, formatMoney);
  const partyNames = result.parties
    .map((party) => party.name.value?.trim())
    .filter(Boolean)
    .slice(0, 3);
  const partyPreview =
    partyNames.length > 0
      ? `${partyNames.join(', ')}${result.parties.length > partyNames.length ? ` +${result.parties.length - partyNames.length} more` : ''}`
      : 'Participants pending confirmation';

  const paymentDetail =
    describePaymentStructure(scheduleRows) ??
    (scheduleRows.length > 0
      ? `${scheduleRows.length} payment release${scheduleRows.length === 1 ? '' : 's'} identified`
      : 'Payment structure requires review');

  const settlementDimension = readiness.dimensions.find((entry) => entry.dimension === 'settlementLogic');
  const settlementDetail =
    scheduleRows.length >= 3 &&
    scheduleRows.some((row) => row.phase === 'deposit') &&
    scheduleRows.some((row) => row.phase === 'milestone')
      ? 'Deposit → milestone → final settlement sequence confirmed from source text'
      : settlementDimension?.blockers.length
        ? settlementDimension.blockers[0] ?? 'Settlement timing captured from agreement language'
        : 'Release conditions tied to agreement milestones and approvals';

  const rows: WorkflowExtractionInsightRow[] = [
    {
      label: 'Who is in the deal',
      detail: partyPreview,
    },
    {
      label: 'How money moves',
      detail: paymentDetail,
    },
    {
      label: 'When settlement releases',
      detail: settlementDetail,
    },
    {
      label: 'What must be delivered',
      detail:
        readiness.dimensions.find((entry) => entry.dimension === 'deliverables')?.blockers.length === 0
          ? 'Operational obligations linked to each participant'
          : 'Service deliverables captured where specified in the agreement',
    },
  ];

  if (result.uncertainties.length > 0) {
    rows.push({
      label: 'What needs a human decision',
      detail: `${result.uncertainties.length} ambiguit${result.uncertainties.length === 1 ? 'y' : 'ies'} flagged — commercial uncertainty surfaced, not hidden`,
    });
  }

  return rows;
}

function inferPaymentTermTitle(
  text: string,
  index: number,
  total: number,
  percentage: number,
): string {
  const normalized = text.toLowerCase();
  if (/deposit|approval|commencement|signing|upon agreement|on agreement/.test(normalized)) {
    return `${percentage}% Deposit`;
  }
  if (/ticket|milestone|validated|2,?000|instalment|tranche/.test(normalized)) {
    return `${percentage}% Milestone Payment`;
  }
  if (/final|after event|post.?event|within.*after|settlement|balance/.test(normalized)) {
    return `${percentage}% Final Settlement`;
  }
  if (index === 0) return `${percentage}% Deposit`;
  if (index === total - 1) return `${percentage}% Final Settlement`;
  if (total === 3 && index === 1) return `${percentage}% Milestone Payment`;
  return `${percentage}% Payment`;
}

function polishScheduleLabel(label: string, percentage: number | null, trigger: string): string {
  const normalized = `${label} ${trigger}`.toLowerCase();
  if (percentage != null) {
    if (/instalment|milestone|ticket|validated|2,?000/.test(normalized)) {
      return `${percentage}% Milestone Payment`;
    }
    if (/deposit|approval|signing/.test(normalized)) {
      return `${percentage}% Deposit`;
    }
    if (/final|after event|settlement|balance/.test(normalized)) {
      return `${percentage}% Final Settlement`;
    }
    return `${percentage}% ${label === 'Settlement' || label === 'Instalment' ? 'Payment' : label}`;
  }

  if (/instalment/i.test(label) && /ticket|milestone|validated|2,?000/i.test(trigger)) {
    return 'Milestone Payment';
  }
  if (/instalment/i.test(label)) return 'Instalment Payment';
  return label;
}

function parsePercentageFromText(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 && value <= 100 ? value : null;
}

function parseMisformattedCurrencyAmount(value: string, projectValue: number): number | null {
  const match = value.match(/^(?:AUD|USD|[A-Z]{3})\s+([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount <= 100 && (projectValue <= 0 || amount < projectValue / 10)) {
    return Math.round(amount);
  }
  return null;
}

function splitTriggerFromValue(value: string): { headline: string; trigger: string | null } {
  const parts = value.split(' — ');
  if (parts.length === 1) {
    return { headline: value.trim(), trigger: null };
  }
  return {
    headline: parts[0]?.trim() ?? value.trim(),
    trigger: parts.slice(1).join(' — ').trim() || null,
  };
}

export function buildWorkflowPaymentScheduleRows(
  result: ExtractionResult,
  formatMoney: (amount: number) => string,
): WorkflowPaymentScheduleRow[] {
  const paymentTerms = result.paymentTerms ?? [];
  if (paymentTerms.length > 0) {
    const projectValue = result.projectValue.value ?? 0;
    const percentageSchedule = paymentTermsLookLikePercentages(paymentTerms);

    return paymentTerms.map((term, index) => {
      const text = termText(term);
      const due = term.dueCondition.value?.trim() || null;
      const rawAmount = term.amount.value;

      let percentage =
        parsePercentageFromText(text) ??
        (percentageSchedule && typeof rawAmount === 'number' ? Math.round(rawAmount) : null);

      let amountLabel: string | null = null;
      if (typeof rawAmount === 'number' && rawAmount > 0 && !percentageSchedule) {
        amountLabel = formatMoney(rawAmount);
      } else if (percentage != null && projectValue > 0) {
        amountLabel = formatMoney(Math.round((projectValue * percentage) / 100));
      } else if (typeof rawAmount === 'number' && rawAmount > 0) {
        amountLabel = formatMoney(rawAmount);
      }

      const title =
        percentage != null
          ? inferPaymentTermTitle(text, index, paymentTerms.length, percentage)
          : polishScheduleLabel(term.description.value?.trim() || `Payment ${index + 1}`, null, text);

      return {
        key: `payment-term-${index}`,
        title,
        amountLabel,
        trigger: due,
        participant: null,
      };
    }).map((row, index, rows) => attachSchedulePresentation(row, index, rows.length));
  }

  const projectValue = result.projectValue.value ?? 0;
  const groups = buildSettlementSchedule(result);
  const rows: Array<Omit<WorkflowPaymentScheduleRow, 'phase' | 'stepNumber' | 'stepLabel'>> = [];

  for (const group of groups) {
    for (const [index, line] of group.lines.entries()) {
      rows.push(
        normalizeSettlementScheduleLine(
          line,
          index,
          group.lines.length,
          projectValue,
          formatMoney,
          group.partyName,
        ),
      );
    }
  }

  return rows.map((row, index) =>
    attachSchedulePresentation(row, index, rows.length),
  );
}

function normalizeSettlementScheduleLine(
  line: SettlementScheduleLine,
  index: number,
  total: number,
  projectValue: number,
  formatMoney: (amount: number) => string,
  participant: string,
): Omit<WorkflowPaymentScheduleRow, 'phase' | 'stepNumber' | 'stepLabel'> {
  const { headline, trigger: parsedTrigger } = splitTriggerFromValue(line.value);
  const trigger = parsedTrigger ?? (line.status === 'conditional' ? 'Conditional release' : null);

  let percentage =
    parsePercentageFromText(headline) ?? parseMisformattedCurrencyAmount(headline, projectValue);

  if (percentage == null && /^\$[\d,]+/.test(headline)) {
    const amount = Number(headline.replace(/[^\d.]/g, ''));
    if (amount > 0 && amount <= 100 && projectValue > 0 && amount < projectValue / 10) {
      percentage = Math.round(amount);
    }
  }

  let amountLabel: string | null = null;
  if (percentage != null && projectValue > 0) {
    amountLabel = formatMoney(Math.round((projectValue * percentage) / 100));
  } else {
    const currencyMatch = headline.match(/^(?:AUD|USD|[A-Z]{3})\s+([\d,]+(?:\.\d+)?)/i);
    const plainMoney = headline.match(/^\$([\d,]+(?:\.\d+)?)/);
    const rawAmount = currencyMatch?.[1] ?? plainMoney?.[1];
    if (rawAmount && percentage == null) {
      const amount = Number(rawAmount.replace(/,/g, ''));
      if (Number.isFinite(amount) && amount > 0) {
        amountLabel = formatMoney(amount);
      }
    } else if (/^\d/.test(headline) && percentage == null) {
      const pctOnly = Number(headline.replace(/[^\d.]/g, ''));
      if (pctOnly > 0 && pctOnly <= 100) {
        percentage = Math.round(pctOnly);
        if (projectValue > 0) {
          amountLabel = formatMoney(Math.round((projectValue * percentage) / 100));
        }
      }
    }
  }

  const title = polishScheduleLabel(
    line.label,
    percentage,
    `${headline} ${trigger ?? ''}`,
  );

  const finalTitle =
    percentage != null && !title.includes('%')
      ? inferPaymentTermTitle(`${line.label} ${headline}`, index, total, percentage)
      : title;

  return {
    key: `${participant}-${line.label}-${index}`,
    title: finalTitle,
    amountLabel,
    trigger,
    participant,
  };
}

function dimensionScore(
  readiness: ExtractionReadinessAssessment,
  dimension: ReadinessDimension,
): number {
  return readiness.dimensions.find((entry) => entry.dimension === dimension)?.score ?? readiness.score;
}

function readinessFromDimensions(
  readiness: ExtractionReadinessAssessment,
  dimensions: ReadinessDimension[],
): number {
  const selected = readiness.dimensions.filter((entry) => dimensions.includes(entry.dimension));
  if (selected.length === 0) return readiness.score;
  const totalWeight = selected.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return readiness.score;
  const weighted = selected.reduce((sum, entry) => sum + entry.score * entry.weight, 0);
  return Math.min(100, Math.round(weighted / totalWeight));
}

export function deriveWorkflowSettlementReadinessDisplay(input: {
  result: ExtractionResult;
  stage: WorkflowJourneyStage;
  approvalsComplete?: boolean;
  approvalProgressPct?: number;
  milestoneUnlocked?: boolean;
  paymentSetupComplete?: boolean;
}): WorkflowReadinessDisplay {
  const readiness = input.result.readinessAssessment ?? buildExtractionReadiness(input.result);
  const {
    stage,
    approvalsComplete = false,
    approvalProgressPct = 0,
    milestoneUnlocked = false,
    paymentSetupComplete = false,
  } = input;

  if (stage === 'agreement' || stage === 'extraction' || stage === 'review') {
    return {
      score: readiness.score,
      label: 'Settlement Readiness',
      summary: readiness.summary,
    };
  }

  if (stage === 'approvals') {
    const unlockedScore = readinessFromDimensions(readiness, [
      'identity',
      'commercialTerms',
      'settlementLogic',
      'compliance',
    ]);
    const score = approvalsComplete
      ? Math.max(readiness.score, unlockedScore)
      : Math.round(
          readiness.score +
            Math.max(0, unlockedScore - readiness.score) * (approvalProgressPct / 100),
        );

    return {
      score: Math.min(100, score),
      label: approvalsComplete ? 'Approvals complete' : 'Awaiting participant approval',
      summary: approvalsComplete
        ? 'All participants approved the commercial workflow — settlement logic is confirmed.'
        : 'Readiness increases as each participant approves the extracted commercial terms.',
    };
  }

  if (stage === 'collection') {
    const confirmedScore = readinessFromDimensions(readiness, [
      'identity',
      'commercialTerms',
      'settlementLogic',
      'deliverables',
      'compliance',
    ]);

    if (milestoneUnlocked && paymentSetupComplete) {
      return {
        score: 100,
        label: 'Ready for Collection',
        summary: 'Contractual conditions are satisfied and Pinch is ready — collect the milestone payment now.',
        showProgressScore: false,
      };
    }

    if (milestoneUnlocked) {
      return {
        score: Math.min(100, Math.max(confirmedScore, 95)),
        label: 'Awaiting Payment Collection',
        summary: 'The contractual milestone is satisfied — payment collection unlocks once Pinch is ready.',
        showProgressScore: false,
      };
    }

    return {
      score: Math.max(readiness.score, confirmedScore),
      label: 'Awaiting Payment Collection',
      summary: 'Settlement readiness advances once milestone conditions are met and payment collection is configured.',
      showProgressScore: false,
    };
  }

  if (stage === 'settlement' || stage === 'complete') {
    return {
      score: 100,
      label: 'Ready for settlement',
      summary: 'Funding and commercial gates are satisfied — settlement can proceed.',
    };
  }

  return {
    score: readiness.score,
    label: 'Settlement Readiness',
    summary: readiness.summary,
  };
}

export function formatWorkflowReadinessHeadline(display: WorkflowReadinessDisplay): string {
  return `${display.label} · ${display.score}%`;
}

export function resolveWorkflowPaymentScheduleCurrency(result: ExtractionResult): string {
  return resolveWorkflowAgreementCurrency(result);
}

export type ExtractionReviewRevenueShareDisplay = {
  headline: string;
  trigger: string | null;
  settlement: string | null;
};

export type ExtractionReviewSettlementGroup = {
  key: string;
  partyName: string;
  kind: 'project_cashflow' | 'payment_schedule' | 'revenue_share' | 'unresolved_timing';
  rows?: WorkflowPaymentScheduleRow[];
  revenueShare?: ExtractionReviewRevenueShareDisplay;
  entitlementLabel?: string | null;
  timingNote?: string | null;
};

function partyIsRevenueShareOnly(party: ExtractedParty): boolean {
  const terms = party.compensationTerms ?? [];
  if (terms.length > 0) {
    const hasRevShare = terms.some((term) => term.type === 'revenue_share');
    const hasFixedLike = terms.some((term) =>
      ['fixed_fee', 'instalment', 'milestone'].includes(term.type),
    );
    if (hasRevShare && !hasFixedLike) return true;
    if (hasFixedLike) return false;
  }
  if (isHybridExtractedParty(party)) return false;
  if (hasFixedFeeAmount(party)) return false;
  return (
    hasRevenueSharePct(party) || party.participationModel.value === 'revenue_share'
  );
}

function pickSettlementRuleText(
  result: ExtractionResult,
  pattern: RegExp,
): string | null {
  for (const rule of result.settlementRules ?? []) {
    const trigger = rule.trigger.value?.trim();
    const basis = rule.basis.value?.trim();
    if (trigger && pattern.test(trigger)) return trigger;
    if (basis && pattern.test(basis)) return basis;
  }
  return null;
}

function buildRevenueShareSettlementDisplay(
  party: ExtractedParty,
  result: ExtractionResult,
): ExtractionReviewRevenueShareDisplay {
  const terms = party.compensationTerms ?? [];
  const revTerm = terms.find((term) => term.type === 'revenue_share');
  const pct = revTerm?.percentage.value ?? party.revenueSharePct.value;
  const basis = revTerm?.revenueBasis.value?.trim();

  let headline = 'Revenue share';
  if (pct != null && basis) {
    headline = `${pct}% of ${basis}`;
  } else if (pct != null) {
    headline = `${pct}% revenue share`;
  } else if (basis) {
    headline = basis;
  }

  const trigger = revTerm?.trigger.value?.trim() || null;

  const settlement =
    pickSettlementRuleText(result, /separat|calculated after|commission/i) ||
    revTerm?.label.value?.trim() ||
    null;

  return { headline, trigger, settlement };
}

function formatPartyEntitlementLabel(
  party: ExtractedParty,
  formatMoney: (amount: number) => string,
): string | null {
  const terms = party.compensationTerms ?? [];
  const fixedTerm = terms.find((term) => term.type === 'fixed_fee' && term.amount.value != null);
  if (fixedTerm?.amount.value != null) {
    return `${formatMoney(fixedTerm.amount.value)} fixed fee`;
  }
  if (hasFixedFeeAmount(party) && party.fixedAmount.value != null) {
    return `${formatMoney(party.fixedAmount.value)} fixed fee`;
  }
  const instalments = terms.filter((term) => term.type === 'instalment' && term.amount.value != null);
  if (instalments.length > 0) {
    return instalments
      .map((term) => `${formatMoney(term.amount.value!)} ${term.label.value?.trim() || 'instalment'}`)
      .join('; ');
  }
  if (hasRevenueSharePct(party) && party.revenueSharePct.value != null) {
    return `${party.revenueSharePct.value}% revenue share`;
  }
  return null;
}

function partyHasFinancialEntitlement(party: ExtractedParty): boolean {
  if (hasFixedFeeAmount(party) || hasRevenueSharePct(party)) return true;
  return (party.compensationTerms ?? []).some(
    (term) => term.amount.value != null || term.percentage.value != null,
  );
}

function eventHasExplicitTiming(trigger: string | null | undefined): boolean {
  return Boolean(trigger?.trim());
}

function buildPartyLinkedPaymentTermRows(
  party: ExtractedParty,
  result: ExtractionResult,
  formatMoney: (amount: number) => string,
): WorkflowPaymentScheduleRow[] {
  const linked = (result.paymentTerms ?? []).filter((term) =>
    paymentTermIsLinkedToParty(term, party),
  );
  if (linked.length === 0) return [];
  return buildWorkflowPaymentScheduleRows(
    { ...result, paymentTerms: linked, settlementEvents: [] },
    formatMoney,
  );
}

function buildPartyCompensationTimingRows(
  party: ExtractedParty,
  formatMoney: (amount: number) => string,
): WorkflowPaymentScheduleRow[] {
  const terms = party.compensationTerms ?? [];
  const rows: WorkflowPaymentScheduleRow[] = [];
  for (const [index, term] of terms.entries()) {
    const trigger = term.trigger.value?.trim() || term.deadline.value?.trim() || null;
    if (!trigger) continue;
    const amount = term.amount.value;
    const percentage = term.percentage.value;
    rows.push({
      key: `${party.id}-term-${term.id}`,
      title: term.label.value?.trim() || (term.type === 'fixed_fee' ? 'Fixed fee' : 'Payment'),
      amountLabel:
        amount != null
          ? formatMoney(amount)
          : percentage != null
            ? `${percentage}%`
            : null,
      trigger,
      participant: party.name.value?.trim() ?? null,
      phase: 'other',
      stepNumber: index + 1,
      stepLabel: 'Payment',
    });
  }
  return rows;
}

function buildPartySettlementScheduleRows(
  party: ExtractedParty,
  result: ExtractionResult,
  formatMoney: (amount: number) => string,
): WorkflowPaymentScheduleRow[] {
  const partyEvents = (result.settlementEvents ?? []).filter(
    (event) =>
      event.partyId.value === party.id && eventHasExplicitTiming(event.trigger.value),
  );
  if (partyEvents.length === 0) return [];

  return buildWorkflowPaymentScheduleRows(
    { ...result, paymentTerms: [], settlementEvents: partyEvents },
    formatMoney,
  );
}

function projectCashflowPartyName(result: ExtractionResult): string {
  const from = result.counterparty?.value?.trim();
  const to = result.projectName?.value?.trim();
  if (from && to) return `${from} → ${to}`;
  return to || from || 'Project';
}

/** Extraction review modal — project cashflow stays separate from participant settlement. */
export function buildExtractionReviewSettlementGroups(
  result: ExtractionResult,
  formatMoney: (amount: number) => string,
): ExtractionReviewSettlementGroup[] {
  const groups: ExtractionReviewSettlementGroup[] = [];

  if ((result.paymentTerms?.length ?? 0) > 0) {
    const projectRows = buildWorkflowPaymentScheduleRows(result, formatMoney);
    if (projectRows.length > 0) {
      groups.push({
        key: 'project-cashflow',
        partyName: projectCashflowPartyName(result),
        kind: 'project_cashflow',
        rows: projectRows,
      });
    }
  }

  for (const party of result.parties) {
    const partyName = party.name.value?.trim() || 'Unnamed participant';
    const entitlementLabel = formatPartyEntitlementLabel(party, formatMoney);

    if (partyIsRevenueShareOnly(party)) {
      const revenueShare = buildRevenueShareSettlementDisplay(party, result);
      groups.push({
        key: party.id,
        partyName,
        kind: 'revenue_share',
        revenueShare,
        entitlementLabel,
        timingNote: revenueShare.trigger ? null : PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT,
      });
      continue;
    }

    const linkedRows = buildPartyLinkedPaymentTermRows(party, result, formatMoney);
    if (linkedRows.length > 0) {
      groups.push({
        key: party.id,
        partyName,
        kind: 'payment_schedule',
        rows: linkedRows,
        entitlementLabel,
      });
      continue;
    }

    const compensationRows = buildPartyCompensationTimingRows(party, formatMoney);
    if (compensationRows.length > 0) {
      groups.push({
        key: party.id,
        partyName,
        kind: 'payment_schedule',
        rows: compensationRows,
        entitlementLabel,
      });
      continue;
    }

    const partyRows = buildPartySettlementScheduleRows(party, result, formatMoney);
    if (partyRows.length > 0) {
      groups.push({
        key: party.id,
        partyName,
        kind: 'payment_schedule',
        rows: partyRows,
        entitlementLabel,
      });
      continue;
    }

    if (partyHasFinancialEntitlement(party)) {
      groups.push({
        key: party.id,
        partyName,
        kind: 'unresolved_timing',
        entitlementLabel,
        timingNote: PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT,
      });
    }
  }

  return groups;
}
