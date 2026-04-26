/**
 * Prisma Client Mock
 */
export const mockPrisma: {
  paymentLink: Record<string, jest.Mock>;
  paymentEvent: Record<string, jest.Mock>;
  fxSnapshot: Record<string, jest.Mock>;
  ledgerEntry: Record<string, jest.Mock>;
  xeroSync: Record<string, jest.Mock>;
  merchantSettings: Record<string, jest.Mock>;
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
} = {
  paymentLink: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  paymentEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  fxSnapshot: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  ledgerEntry: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  xeroSync: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  merchantSettings: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback: (p: typeof mockPrisma) => unknown) => callback(mockPrisma)),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
}

export function resetPrismaMocks() {
  for (const mockFn of Object.values(mockPrisma)) {
    if (mockFn && typeof mockFn === 'object') {
      for (const fn of Object.values(mockFn)) {
        if (fn && typeof fn === 'object' && 'mockReset' in fn && typeof (fn as { mockReset: () => void }).mockReset === 'function') {
          (fn as { mockReset: () => void }).mockReset();
        }
      }
    }
  }
}







