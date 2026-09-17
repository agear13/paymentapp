export const commitmentRegistryAbi = [
  {
    type: 'function',
    name: 'registerCommitment',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'commitmentId', type: 'bytes32' },
      { name: 'buyerRefHash', type: 'bytes32' },
      { name: 'supplierRefHash', type: 'bytes32' },
      { name: 'amountMinorUnits', type: 'uint256' },
      { name: 'sourceCurrency', type: 'bytes32' },
      { name: 'settlementCurrency', type: 'bytes32' },
      { name: 'dueDate', type: 'uint64' },
      { name: 'purposeHash', type: 'bytes32' },
      { name: 'termsHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCommitment',
    stateMutability: 'view',
    inputs: [{ name: 'commitmentId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'commitmentId', type: 'bytes32' },
          { name: 'creator', type: 'address' },
          { name: 'buyerRefHash', type: 'bytes32' },
          { name: 'supplierRefHash', type: 'bytes32' },
          { name: 'amountMinorUnits', type: 'uint256' },
          { name: 'sourceCurrency', type: 'bytes32' },
          { name: 'settlementCurrency', type: 'bytes32' },
          { name: 'dueDate', type: 'uint64' },
          { name: 'purposeHash', type: 'bytes32' },
          { name: 'termsHash', type: 'bytes32' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'updateCommitmentStatus',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'commitmentId', type: 'bytes32' },
      { name: 'newStatus', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'CommitmentRegistered',
    inputs: [
      { name: 'commitmentId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'termsHash', type: 'bytes32', indexed: false },
      { name: 'amountMinorUnits', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CommitmentUpdated',
    inputs: [
      { name: 'commitmentId', type: 'bytes32', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CommitmentFulfilled',
    inputs: [{ name: 'commitmentId', type: 'bytes32', indexed: true }],
  },
] as const;
