/**
 * Prisma Client Mock
 */

export const mockPrisma = {
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
  $transaction: jest.fn((callback) => callback(mockPrisma)),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
}

export function resetPrismaMocks() {
  Object.values(mockPrisma).forEach((mockFn) => {
    if (typeof mockFn === 'object') {
      Object.values(mockFn).forEach((fn) => {
        if (typeof fn.mockReset === 'function') {
          fn.mockReset()
        }
      })
    }
  })
}







