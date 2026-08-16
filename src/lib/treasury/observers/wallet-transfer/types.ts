export type ObservedOutboundTransfer = {
  providerReference: string;
  transactionHash: string;
  asset: string;
  amount: string;
  sourceAddress: string;
  destinationAddress: string;
  walletNetwork: string;
  occurredAt: Date;
  confirmationStatus: 'CONFIRMED';
  observationSource: 'alchemy_rpc' | 'alchemy_webhook' | 'hedera_mirror';
  rawProviderPayload?: Record<string, unknown>;
};
