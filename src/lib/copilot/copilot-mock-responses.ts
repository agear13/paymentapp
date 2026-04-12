import type {
  AssistantStructuredBlock,
  CopilotScreenContext,
  PendingAction,
} from './copilot-types';

export type MockAssistantPayload = {
  blocks: AssistantStructuredBlock[];
  pendingAction?: PendingAction | null;
};

/**
 * Deterministic mocked assistant output for MVP UX — keyed by suggestion label.
 */
export function getMockAssistantResponse(
  suggestion: string,
  screen: CopilotScreenContext,
): MockAssistantPayload {
  const key = suggestion.trim();

  if (key === "What's blocking this deal?") {
    return {
      blocks: [
        {
          type: 'text',
          content:
            'Here is a quick read on blockers for this deal. Confirm export when you want a CSV stub.',
        },
        {
          type: 'diagnostic',
          title: 'Deal blockers',
          summary: 'Two items need resolution before payouts can run.',
          items: [
            {
              id: '1',
              label: 'Compliance review',
              detail: 'Waiting on KYC refresh for one counterparty.',
              severity: 'warning',
            },
            {
              id: '2',
              label: 'Funding rail',
              detail: 'Wise payout rail is disabled for this merchant.',
              severity: 'critical',
            },
            {
              id: '3',
              label: 'Signatures',
              detail: 'All commercial signatures are collected.',
              severity: 'info',
            },
          ],
        },
      ],
    };
  }

  if (key === 'What am I missing?') {
    return {
      blocks: [
        {
          type: 'text',
          content:
            'Use this checklist to finish merchant configuration. Checked items are mocked for the demo.',
        },
        {
          type: 'checklist',
          title: 'Setup completeness',
          items: [
            { id: 'a', label: 'Business profile', done: true, hint: 'Verified' },
            { id: 'b', label: 'Payout destination', done: false, hint: 'Add a default bank or Wise' },
            { id: 'c', label: 'Tax identifiers', done: false },
            { id: 'd', label: 'Notification contacts', done: true },
          ],
        },
      ],
    };
  }

  if (key === 'Export payouts for this deal') {
    const actionId = 'export_payouts_stub';
    return {
      pendingAction: {
        id: actionId,
        title: 'Export payout lines (stub)',
        description:
          'Generates a placeholder CSV for this deal. No file is written in this MVP — confirms the confirmation flow only.',
        confirmLabel: 'Export',
        cancelLabel: 'Not now',
        contextHint: screen,
      },
      blocks: [
        {
          type: 'text',
          content:
            'Ready to export payout lines for this deal. This is a stub — confirm to see a mock result card.',
        },
        {
          type: 'action_confirm',
          actionId,
          title: 'Export deal payouts',
          description: 'CSV format: deal id, counterparty, amount, status (mock).',
          confirmLabel: 'Run export',
          cancelLabel: 'Dismiss',
        },
      ],
    };
  }

  if (key === 'Help me configure Wise') {
    return {
      blocks: [
        {
          type: 'warning',
          title: 'Wise connection',
          message:
            'Wise must be enabled under payouts and your merchant must pass rail checks. This panel is guidance only until backend tools ship.',
        },
        {
          type: 'text',
          content:
            'Next: open payouts, verify business entity, then attach a Wise recipient. Ask again when the API is live for step-by-step tool calls.',
        },
      ],
    };
  }

  if (key === "Why can't I use Wise?") {
    return {
      blocks: [
        {
          type: 'diagnostic',
          title: 'Wise availability',
          items: [
            {
              id: 'w1',
              label: 'Merchant rail',
              detail: 'Wise payouts may be off for this workspace.',
              severity: 'warning',
            },
            {
              id: 'w2',
              label: 'Currency pair',
              detail: 'Pair not supported for this invoice.',
              severity: 'info',
            },
          ],
        },
      ],
    };
  }

  if (key === "Who hasn't approved?") {
    return {
      blocks: [
        {
          type: 'text',
          content: 'Approval chain (mock):',
        },
        {
          type: 'diagnostic',
          title: 'Pending approvers',
          items: [
            { id: 'p1', label: 'Partner ops', detail: 'Awaiting since Tue', severity: 'warning' },
            { id: 'p2', label: 'Finance', detail: 'Approved', severity: 'info' },
          ],
        },
      ],
    };
  }

  if (key === 'Explain the ledger') {
    return {
      blocks: [
        {
          type: 'text',
          content:
            'The ledger records immutable money movement: charges, fees, payouts, and adjustments. Reports read from ledger lines; invoices trigger intents that settle into ledger entries.',
        },
      ],
    };
  }

  // Default fallback
  return {
    blocks: [
      {
        type: 'text',
        content: `You asked: “${key}”. Full LLM answers are not wired yet — this is a structured stub for the “${screen}” screen.`,
      },
    ],
  };
}

export function getMockComposerReply(input: string): MockAssistantPayload {
  return {
    blocks: [
      {
        type: 'text',
        content: `Received: “${input.trim()}”. Composer replies are stubbed until chat backend is connected.`,
      },
    ],
  };
}

export function getMockPendingActionResult(pending: { id: string; title: string }): MockAssistantPayload {
  return {
    blocks: [
      {
        type: 'action_result',
        title: pending.title,
        message:
          'Mock export completed. In production this would download a file or enqueue a job.',
        success: true,
      },
    ],
  };
}
