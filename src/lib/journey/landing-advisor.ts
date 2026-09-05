import type { LandingResultFilters } from '@/lib/journey/landing-result-labels';
import { PAYMENT_METHOD_OPTIONS, PROVIDER_TYPE_OPTIONS } from '@/lib/journey/landing-result-labels';
import { EMPTY_LANDING_FILTERS } from '@/lib/journey/landing-provider-search';
import {
  countryName,
  formatLandingAmount,
  isLandingCountryCode,
  isLandingPriorityId,
  isLandingTransactionTypeId,
  priorityLabel,
  transactionTypeLabel,
  type LandingCountryCode,
  type LandingPriorityId,
  type LandingTransactionTypeId,
} from '@/lib/journey/landing-route-model';
import {
  developmentsForAdvisor,
  findIntelligenceItem,
  thisMattersBecause,
} from '@/lib/journey/payment-intelligence-rank';

export const ADVISOR_INTRO_STORAGE_KEY = 'provvy.advisorIntroSeen';
export const LANDING_ADVISOR_SLOT_ID = 'landing-advisor-slot';

export type AdvisorStage = 'welcome' | 'search' | 'results' | 'detail';

export type AdvisorContext = {
  stage: AdvisorStage;
  origin: string | null;
  destination: string | null;
  amount: number | null;
  currency: string | null;
  transactionType: LandingTransactionTypeId | null;
  priority: LandingPriorityId | null;
  priorityChanged: boolean;
  selectedProvider: string | null;
  resultCount: number | null;
  visibleResultCount: number | null;
  recommendedProvider: string | null;
  recommendedProviderId: string | null;
  recommendationReason: string | null;
  productName: string | null;
  paymentMethodLabel: string | null;
  indicativeCostLabel: string | null;
  arrivalLabel: string | null;
  setupLabel: string | null;
  characteristics: string | null;
  knownLimitation: string | null;
  filterNote: string | null;
  highlightedIntelligenceId: string | null;
  connected: false;
  showThemeChoice: boolean;
};

export type AdvisorActionId =
  | 'theme-light'
  | 'theme-dark'
  | 'personalise'
  | 'keep-exploring'
  | 'why-first'
  | 'whats-faster'
  | 'whats-simpler'
  | 'whats-cheaper'
  | 'what-is-digital-dollar'
  | 'exclude-digital-dollar'
  | 'show-developments'
  | 'show-affected-routes';

export type AdvisorAction = {
  id: AdvisorActionId;
  label: string;
  href?: string;
};

export type AdvisorPresentation = {
  eyebrow: string;
  status: string;
  criteria: string[];
  conclusion: string | null;
  lines: string[];
  developments: { headline: string; impact: string }[];
  actions: AdvisorAction[];
  explainer: { title: string; body: string; action?: AdvisorAction } | null;
  personaliseSupport: string | null;
};

export const EMPTY_ADVISOR_CONTEXT: AdvisorContext = {
  stage: 'welcome',
  origin: null,
  destination: null,
  amount: null,
  currency: null,
  transactionType: null,
  priority: null,
  priorityChanged: false,
  selectedProvider: null,
  resultCount: null,
  visibleResultCount: null,
  recommendedProvider: null,
  recommendedProviderId: null,
  recommendationReason: null,
  productName: null,
  paymentMethodLabel: null,
  indicativeCostLabel: null,
  arrivalLabel: null,
  setupLabel: null,
  characteristics: null,
  knownLimitation: null,
  filterNote: null,
  highlightedIntelligenceId: null,
  connected: false,
  showThemeChoice: false,
};

export const DIGITAL_DOLLAR_ADVISOR_EXPLAINER =
  'Digital-dollar transfer uses a digital currency rail to move value between compatible wallets or accounts. It can settle quickly, but both sides need the right setup.';

export const ADVISOR_PERSONALISE_SUPPORT =
  'Connect your business so Provvy can consider your existing rails, cash position, negotiated FX, supplier terms and history.';

const ADVISOR_EYEBROW = 'PROVVY ADVISOR';

export function hasSeenAdvisorIntro(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(ADVISOR_INTRO_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markAdvisorIntroSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADVISOR_INTRO_STORAGE_KEY, '1');
  } catch {
    // Ignore — worst case the intro can appear again.
  }
}

function priorityFocus(priority: LandingPriorityId | null): string {
  switch (priority) {
    case 'fastest':
      return 'speed';
    case 'simplest':
      return 'simplicity';
    case 'lowest_cost':
    default:
      return 'lowest total cost';
  }
}

function paymentTypeLabel(type: LandingTransactionTypeId | null): string {
  return type ? type.replace(/_/g, ' ') : 'payment';
}

function displayProvider(context: AdvisorContext): string {
  if (context.recommendedProviderId === 'bank') return 'your existing bank';
  return context.recommendedProvider ?? 'This route';
}

export function advisorExcludeDigitalDollarFilters(): LandingResultFilters {
  return {
    ...EMPTY_LANDING_FILTERS,
    providerTypes: PROVIDER_TYPE_OPTIONS.filter((option) => option.id !== 'digital_asset').map(
      (option) => option.id
    ),
  };
}

function excludesDigitalDollarOnly(filters: LandingResultFilters): boolean {
  const expected = advisorExcludeDigitalDollarFilters().providerTypes;
  if (filters.providerTypes.length !== expected.length) return false;
  if (expected.some((id) => !filters.providerTypes.includes(id))) return false;
  return (
    filters.paymentMethods.length === 0 &&
    filters.speed.length === 0 &&
    filters.cost.length === 0 &&
    filters.setup.length === 0 &&
    filters.recipient.length === 0 &&
    filters.business.length === 0
  );
}

export function advisorFilterNote(filters: LandingResultFilters): string | null {
  const active =
    filters.paymentMethods.length +
    filters.providerTypes.length +
    filters.speed.length +
    filters.cost.length +
    filters.setup.length +
    filters.recipient.length +
    filters.business.length;
  if (active <= 0) return null;
  if (excludesDigitalDollarOnly(filters)) {
    return "You've narrowed this to routes that don't require a digital-dollar setup.";
  }
  if (filters.paymentMethods.length === 1 && active === 1) {
    const method = filters.paymentMethods[0];
    const label =
      PAYMENT_METHOD_OPTIONS.find((option) => option.id === method)?.label.toLowerCase() ??
      'selected';
    if (method === 'bank_transfer') {
      return "You've narrowed this to bank-transfer routes. The comparison now excludes the other payment methods.";
    }
    if (method === 'stablecoin') {
      return "You've narrowed this to digital-dollar routes. The comparison now excludes the other payment methods.";
    }
    return `You've narrowed this to ${label} routes. The comparison now excludes the other payment methods.`;
  }
  return "You've narrowed the routes shown. The comparison now excludes the other payment methods.";
}

export function advisorCriteria(context: AdvisorContext): string[] {
  const chips: string[] = [];
  if (context.amount && context.currency) {
    chips.push(formatLandingAmount(context.amount, context.currency));
  }
  if (context.origin && isLandingCountryCode(context.origin) && context.destination && isLandingCountryCode(context.destination)) {
    chips.push(
      context.origin === context.destination
        ? countryName(context.origin)
        : `${countryName(context.origin)} → ${countryName(context.destination)}`
    );
  }
  if (context.transactionType && isLandingTransactionTypeId(context.transactionType)) {
    chips.push(transactionTypeLabel(context.transactionType));
  }
  if (context.priority && isLandingPriorityId(context.priority)) {
    chips.push(priorityLabel(context.priority));
  }
  return chips;
}

function advisorDevelopments(context: AdvisorContext) {
  if (!context.origin || !context.destination) return [];
  if (!isLandingCountryCode(context.origin) || !isLandingCountryCode(context.destination)) return [];
  return developmentsForAdvisor({
    origin: context.origin,
    destination: context.destination,
    scope: 'all',
  }).map((item) => ({ headline: item.headline, impact: item.businessImpact }));
}

function advisorStatus(context: AdvisorContext): string {
  if (context.stage === 'welcome' || context.stage === 'search') {
    return context.origin && context.destination
      ? 'Watching this corridor'
      : 'Ready to analyse a payment';
  }
  if (context.priorityChanged) return 'Recommendation changed';
  if (context.filterNote) return 'Criteria updated';
  return 'Based on your current criteria';
}

function resultConclusion(context: AdvisorContext): string {
  const named = context.recommendedProvider ?? 'This route';
  const provider = displayProvider(context);
  const reason = `because ${priorityFocus(context.priority)} is your priority`;

  if (context.priorityChanged && context.priority === 'simplest') {
    return `Your existing bank is now the strongest starting point ${reason}.`;
  }
  if (context.priorityChanged) {
    return `${named} is now the strongest starting point ${reason}.`;
  }
  if (context.priority === 'simplest' && context.recommendedProviderId === 'bank') {
    return `${provider.charAt(0).toUpperCase()}${provider.slice(1)} is the strongest starting point for this payment based on what you've entered.`;
  }
  return `${named} is the strongest starting point for this payment based on what you've entered.`;
}

function whyThisFirst(context: AdvisorContext): string[] {
  const provider =
    context.recommendedProviderId === 'bank'
      ? 'Your existing bank'
      : (context.recommendedProvider ?? 'This route');
  const whyLabel =
    context.priority === 'fastest' ? 'fastest for this payment' : 'first among the indicative routes shown';
  const lines = [
    `Based on what you've entered, ${priorityFocus(context.priority)} is the current priority for this ${paymentTypeLabel(context.transactionType)}.`,
    `${provider} is the ${whyLabel}.`,
  ];
  if (context.recommendationReason) {
    lines.push(context.recommendationReason);
  }
  if (context.indicativeCostLabel) {
    lines.push(`Typical estimated total: ${context.indicativeCostLabel}.`);
  }
  if (context.arrivalLabel) {
    lines.push(`Typical arrival: ${context.arrivalLabel}.`);
  }
  if (context.setupLabel) {
    lines.push(`Typical setup: ${context.setupLabel}.`);
  }
  if (context.productName) {
    const method = context.paymentMethodLabel ? ` (${context.paymentMethodLabel})` : '';
    lines.push(`Route: ${context.productName}${method}.`);
  }
  if (context.characteristics) {
    lines.push(`Typical route characteristics: ${context.characteristics}.`);
  }
  if (context.knownLimitation) {
    lines.push(`Known limitation: ${context.knownLimitation}`);
  }
  if (context.recommendedProviderId === 'bank') {
    lines.push('I do not know which bank you actually use.');
  }
  lines.push(
    'These are typical route characteristics, not live quotes. Once connected, Provvy can consider your cash position, existing rails, negotiated FX and supplier terms.'
  );
  return uniqueLines(lines);
}

function resultActions(context: AdvisorContext): AdvisorAction[] {
  const actions: AdvisorAction[] = [];
  actions.push({
    id: 'why-first',
    label: context.priority === 'fastest' ? 'Why is this fastest?' : 'Why is this #1?',
  });

  if (context.priority === 'fastest' && context.recommendedProviderId === 'digital_dollar') {
    actions.push({ id: 'what-is-digital-dollar', label: 'What is digital-dollar?' });
  } else if (context.priority !== 'fastest') {
    actions.push({ id: 'whats-faster', label: "What's faster?" });
  }

  if (context.priority !== 'simplest') {
    actions.push({ id: 'whats-simpler', label: "What's simpler?" });
  } else {
    actions.push({ id: 'whats-cheaper', label: "What's cheaper?" });
  }

  actions.push({ id: 'personalise', label: 'Personalise this answer' });
  return actions.slice(0, 4);
}

function supportingLines(context: AdvisorContext, action?: AdvisorActionId | null): string[] {
  const lines: string[] = [];
  if (context.filterNote) lines.push(context.filterNote);
  if (context.stage === 'detail' && context.selectedProvider) {
    lines.push(
      `This is the ${context.selectedProvider} route for the payment you entered. Provvy has not sent this payment.`
    );
  }
  const highlighted = findIntelligenceItem(context.highlightedIntelligenceId);
  if (highlighted) {
    lines.push(thisMattersBecause(highlighted));
  }
  if (action === 'why-first') {
    lines.push(...whyThisFirst(context));
  }
  return uniqueLines(lines);
}

export function presentAdvisor(
  context: AdvisorContext,
  action?: AdvisorActionId | null
): AdvisorPresentation {
  if (context.stage === 'welcome' || context.stage === 'search') {
    const developments = advisorDevelopments(context);
    const highlighted = findIntelligenceItem(context.highlightedIntelligenceId);
    const corridor =
      context.origin &&
      context.destination &&
      isLandingCountryCode(context.origin) &&
      isLandingCountryCode(context.destination)
        ? `${countryName(context.origin as LandingCountryCode)} → ${countryName(context.destination as LandingCountryCode)}`
        : 'this corridor';
    const lines: string[] = [];
    const actions: AdvisorAction[] = [];
    if (highlighted) {
      lines.push(thisMattersBecause(highlighted));
      actions.push({ id: 'show-affected-routes', label: 'Show me routes affected by this' });
      actions.push({ id: 'personalise', label: 'What does this mean for my business?' });
    } else if (developments.length) {
      lines.push(
        `Provvy is watching ${developments.length} developments that could affect payments on ${corridor}.`
      );
      actions.push({ id: 'show-developments', label: 'Show me' });
    } else {
      lines.push('Compare a payment and Provvy will interpret the routes against your criteria.');
    }
    return {
      eyebrow: ADVISOR_EYEBROW,
      status: advisorStatus(context),
      criteria: advisorCriteria(context),
      conclusion: null,
      lines,
      developments: [],
      actions,
      explainer: null,
      personaliseSupport: null,
    };
  }

  const explainer =
    action === 'what-is-digital-dollar'
      ? {
          title: 'What is digital-dollar?',
          body: DIGITAL_DOLLAR_ADVISOR_EXPLAINER,
          action: {
            id: 'exclude-digital-dollar' as const,
            label: "Show me routes that don't require this",
          },
        }
      : null;

  return {
    eyebrow: ADVISOR_EYEBROW,
    status: advisorStatus(context),
    criteria: advisorCriteria(context),
    conclusion: resultConclusion(context),
    lines: supportingLines(context, action),
    developments: [],
    actions: resultActions(context),
    explainer,
    personaliseSupport: ADVISOR_PERSONALISE_SUPPORT,
  };
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}
