import {
  DEFAULT_JARVIS_ORB_SEQUENCE,
  type JarvisOrbStep,
} from '@/lib/jarvis/jarvis-orb-states';
import {
  jarvisDemoAudioPath,
  type JarvisDemoAudioAsset,
} from '@/lib/jarvis/jarvis-demo-audio';

/**
 * Demo runs are always simulated. A later adapter may call `backendAction.id`
 * against a real Provvy API — this file must not invoke those APIs.
 */
export type JarvisDemoExecutionMode = 'simulated';

export type JarvisBackendConnection = 'ready' | 'partial' | 'none';

export type JarvisDemoBackendAction = {
  id: string;
  canConnect: boolean;
  connection: JarvisBackendConnection;
  execution: JarvisDemoExecutionMode;
  notes: string;
};

export type JarvisDemoScenario = {
  id: string;
  label: string;
  userInstruction: string;
  /** Shown while the orb is speaking / executing — intention, not completion. */
  spokenResponse: string;
  /** Shown only in the success state. */
  successResponse: string;
  /** Prerecorded clip of `spokenResponse`. File may be absent. */
  audioResponse: JarvisDemoAudioAsset | null;
  orbSequence: readonly JarvisOrbStep[];
  simulatedResult: {
    kind: 'simulated';
    summary: string;
  };
  backendAction: JarvisDemoBackendAction;
};

const spokenClip = (scenarioId: string): JarvisDemoAudioAsset => ({
  src: jarvisDemoAudioPath(scenarioId, 'mp3'),
  mimeType: 'audio/mpeg',
});

export const JARVIS_DEMO_HERO_SCENARIO_ID = 'invoice-execution';

export const JARVIS_DEMO_SCENARIOS: readonly JarvisDemoScenario[] = [
  {
    id: 'invoice-execution',
    label: 'Generate an invoice',
    userInstruction:
      'Provvy, generate the $4,800 invoice for Apex Promotions and send it to Sarah.',
    spokenResponse:
      "Absolutely. I'll generate the $4,800 invoice for Apex Promotions and send it to Sarah.",
    successResponse: 'Done. The invoice has been generated and sent to Sarah.',
    audioResponse: spokenClip('invoice-execution'),
    orbSequence: DEFAULT_JARVIS_ORB_SEQUENCE,
    simulatedResult: {
      kind: 'simulated',
      summary: 'Staged invoice create-and-send. No payment link is created.',
    },
    backendAction: {
      id: 'invoice.create_and_send',
      canConnect: true,
      connection: 'ready',
      execution: 'simulated',
      notes:
        'Can later use POST /api/payment-links then POST /api/payment-links/[id]/send. Send requires an email, not a first name. Demo does not call them.',
    },
  },
  {
    id: 'business-information',
    label: 'Supplier obligations',
    userInstruction: 'Provvy, how much do I owe my suppliers this week?',
    spokenResponse: "I'll check what you owe your suppliers this week.",
    successResponse:
      'You have $18,420 in outstanding supplier obligations across seven invoices. Three are due this week.',
    audioResponse: spokenClip('business-information'),
    orbSequence: DEFAULT_JARVIS_ORB_SEQUENCE,
    simulatedResult: {
      kind: 'simulated',
      summary: 'Staged supplier-obligation totals for the campaign preview.',
    },
    backendAction: {
      id: 'query.supplier_obligations',
      canConnect: true,
      connection: 'ready',
      execution: 'simulated',
      notes:
        'Can later read GET /api/deal-network-pilot/obligations or GET /api/operations/coordination-snapshot. Demo does not call them.',
    },
  },
  {
    id: 'workspace-status',
    label: 'Beach Event status',
    userInstruction: "Provvy, what's holding up the Beach Event?",
    spokenResponse: "I'll see what's holding up the Beach Event.",
    successResponse:
      "Two participants haven't approved the agreement. One is also missing their payout details.",
    audioResponse: spokenClip('workspace-status'),
    orbSequence: DEFAULT_JARVIS_ORB_SEQUENCE,
    simulatedResult: {
      kind: 'simulated',
      summary: 'Staged workspace blockers. No live project is queried.',
    },
    backendAction: {
      id: 'workspace.get_activation_status',
      canConnect: true,
      connection: 'ready',
      execution: 'simulated',
      notes:
        'Can later read GET /api/workspace/activation or GET /api/operations/coordination-snapshot. Demo does not call them.',
    },
  },
  {
    id: 'participant-coordination',
    label: 'Remind approvals',
    userInstruction: "Provvy, remind everyone who hasn't approved.",
    spokenResponse: "I'll remind everyone who hasn't approved yet.",
    successResponse: "Done. I've sent reminders to the two participants who are still outstanding.",
    audioResponse: spokenClip('participant-coordination'),
    orbSequence: DEFAULT_JARVIS_ORB_SEQUENCE,
    simulatedResult: {
      kind: 'simulated',
      summary: 'Staged approval reminders. No invitation emails are sent.',
    },
    backendAction: {
      id: 'participant.request_approval',
      canConnect: true,
      connection: 'partial',
      execution: 'simulated',
      notes:
        'Per-participant POST /api/workflows/[id]/agreement/participants/[participantId] with request_approval exists. There is no batch remind-all API. Demo does not call it.',
    },
  },
  {
    id: 'settlement-preparation',
    label: 'Settlement prep',
    userInstruction: "Provvy, get everything ready for tomorrow's settlement.",
    spokenResponse: "I'll get everything ready for tomorrow's settlement.",
    successResponse:
      "I've prepared everything I can. One participant is still missing payout details. I've asked them to provide it and I'll let you know when they're ready.",
    audioResponse: spokenClip('settlement-preparation'),
    orbSequence: DEFAULT_JARVIS_ORB_SEQUENCE,
    simulatedResult: {
      kind: 'simulated',
      summary: 'Staged settlement readiness. No payout batch is created.',
    },
    backendAction: {
      id: 'settlement.prepare_readiness',
      canConnect: true,
      connection: 'partial',
      execution: 'simulated',
      notes:
        'Readiness can later use GET /api/operations/coordination-snapshot. Asking for missing payout details is per-participant. Release/create batch is beta-gated. Demo does not call them.',
    },
  },
] as const;

export const getJarvisDemoScenario = (
  id: string,
  scenarios: readonly JarvisDemoScenario[] = JARVIS_DEMO_SCENARIOS
): JarvisDemoScenario | undefined => scenarios.find((scenario) => scenario.id === id);
