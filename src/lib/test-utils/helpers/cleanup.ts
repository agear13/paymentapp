/**
 * Test Cleanup Helpers
 */

import { resetPrismaMocks } from '../mocks/prisma.mock'
import { resetXeroMocks } from '../mocks/xero-client.mock'

export function resetAllMocks(): void {
  resetPrismaMocks()
  resetXeroMocks()
  jest.clearAllMocks()
}

export function cleanupTestData(): void {
  // Clear any test data from database (if using real DB in tests)
  // This would be used in integration tests
}







