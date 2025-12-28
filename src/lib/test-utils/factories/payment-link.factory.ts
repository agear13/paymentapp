/**
 * Payment Link Test Factory
 */

import type { PaymentLink } from '@prisma/client'

export function createMockPaymentLink(
  overrides?: Partial<PaymentLink>
): PaymentLink {
  const id = overrides?.id || `test-link-${Date.now()}`
  
  return {
    id,
    shortCode: overrides?.shortCode || generateShortCode(),
    organizationId: overrides?.organizationId || 'test-org-123',
    amount: overrides?.amount || '100.00',
    currency: overrides?.currency || 'AUD', // Default to AUD for AUDD testing
    description: overrides?.description || 'Test Payment',
    status: overrides?.status || 'OPEN',
    invoiceReference: overrides?.invoiceReference || `INV-${Date.now()}`,
    customerEmail: overrides?.customerEmail || null,
    customerPhone: overrides?.customerPhone || null,
    expiresAt: overrides?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    paymentMethod: overrides?.paymentMethod || null,
    paidAt: overrides?.paidAt || null,
    createdAt: overrides?.createdAt || new Date(),
    updatedAt: overrides?.updatedAt || new Date(),
    createdBy: overrides?.createdBy || 'test-user-123',
    metadata: overrides?.metadata || null,
  } as PaymentLink
}

export function createMockPaymentLinkWithAudd(
  overrides?: Partial<PaymentLink>
): PaymentLink {
  return createMockPaymentLink({
    currency: 'AUD',
    paymentMethod: 'HEDERA',
    ...overrides,
  })
}

export function createMockPaidPaymentLink(
  overrides?: Partial<PaymentLink>
): PaymentLink {
  return createMockPaymentLink({
    status: 'PAID',
    paymentMethod: 'HEDERA',
    paidAt: new Date(),
    ...overrides,
  })
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}







