import type { CopilotScreenContext } from './copilot-types';

const SCREEN_SUGGESTIONS: Record<CopilotScreenContext, string[]> = {
  payment_links: [
    'Help me create my first invoice',
    'What payment methods are configured?',
    "Why can't I use Wise?",
  ],
  payment_link_detail: [
    'Summarize this invoice for a customer',
    'What payment methods apply here?',
    'How do I resend or void this link?',
  ],
  deal_network: [
    'Which deals need attention?',
    'Show partners with pending onboarding',
    'What filters should I use here?',
  ],
  deal_detail: [
    "What's blocking this deal?",
    "Who hasn't approved?",
    'Export payouts for this deal',
  ],
  merchant_settings: [
    'What am I missing?',
    'Help me configure Wise',
    'Explain the ledger',
  ],
  unknown: [
    'What can you help me with on this page?',
    'Summarize my workspace status',
    'Where should I go next?',
  ],
};

export function getSuggestionsForScreen(screen: CopilotScreenContext): string[] {
  return [...SCREEN_SUGGESTIONS[screen]];
}
