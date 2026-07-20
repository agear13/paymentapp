/**
 * Canton provider extension points.
 *
 * Implement these when wiring a real Canton / Daml integration.
 * The Commercial Domain must not change when these are filled in.
 */

export const CANTON_EXTENSION_POINT_IDS = [
  'agreement_synchronization',
  'workflow_commands',
  'participant_commands',
  'settlement_commands',
  'event_subscription',
  'projection_updates',
] as const;

export type CantonExtensionPointId = (typeof CANTON_EXTENSION_POINT_IDS)[number];

export type CantonExtensionPoint = {
  id: CantonExtensionPointId;
  title: string;
  description: string;
  /** Provider methods that should call into this extension. */
  providerMethods: string[];
  implemented: boolean;
};

/**
 * Clearly documented extension points for the Canton skeleton.
 */
export const CANTON_EXTENSION_POINTS: CantonExtensionPoint[] = [
  {
    id: 'agreement_synchronization',
    title: 'Agreement Synchronization',
    description:
      'Create/update Shared Commercial Agreements on the Canton ledger (Daml contracts). Map Provvypay agreementIds to Canton contract keys / parties.',
    providerMethods: [
      'createSharedCommercialAgreement',
      'updateCommercialAgreement',
      'synchronizeSharedState',
      'validateConnection',
    ],
    implemented: true,
  },
  {
    id: 'workflow_commands',
    title: 'Workflow Commands',
    description:
      'Submit Canton choices that transition commercial / settlement workflow lanes. Map WorkflowTransitionCommand → DeclareSettlementReady.',
    providerMethods: ['transitionWorkflow'],
    implemented: true,
  },
  {
    id: 'participant_commands',
    title: 'Participant Commands',
    description:
      'Submit participant approval choices (progressive Accept) on Canton. Map ParticipantApprovalCommand → Accept exercise.',
    providerMethods: ['submitParticipantApproval'],
    implemented: true,
  },
  {
    id: 'settlement_commands',
    title: 'Settlement Commands',
    description:
      'Platform declares SettlementReady attestation (accountant is not a ledger party).',
    providerMethods: ['submitSettlementApproval'],
    implemented: true,
  },
  {
    id: 'event_subscription',
    title: 'Event Subscription',
    description:
      'Normalize Canton workflow transitions into CommercialNetworkEvent kinds for the Event Dispatcher.',
    providerMethods: ['subscribeToWorkflowEvents', 'publishCommercialEvent'],
    implemented: true,
  },
  {
    id: 'projection_updates',
    title: 'Projection Updates',
    description:
      'Drive Projection Service from Canton events so Commercial Domain read models stay current without domain knowing about Canton.',
    providerMethods: ['synchronizeSharedState', 'subscribeToWorkflowEvents'],
    implemented: true,
  },
];

export function getCantonExtensionPoints(): CantonExtensionPoint[] {
  return CANTON_EXTENSION_POINTS;
}
