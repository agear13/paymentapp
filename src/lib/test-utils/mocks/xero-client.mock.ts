/**
 * Xero API Client Mock
 */

import { createMockXeroInvoiceResponse, createMockXeroPaymentResponse } from '../factories/xero.factory'

export const mockXeroClient = {
  accountingApi: {
    createInvoices: jest.fn().mockResolvedValue(createMockXeroInvoiceResponse()),
    createPayments: jest.fn().mockResolvedValue(createMockXeroPaymentResponse()),
    getAccounts: jest.fn().mockResolvedValue({
      accounts: [
        { accountID: 'account-1054', code: '1054', name: 'Crypto Clearing - AUDD', type: 'CURRENT' },
        { accountID: 'account-1051', code: '1051', name: 'Crypto Clearing - HBAR', type: 'CURRENT' },
        { accountID: 'account-1052', code: '1052', name: 'Crypto Clearing - USDC', type: 'CURRENT' },
        { accountID: 'account-1053', code: '1053', name: 'Crypto Clearing - USDT', type: 'CURRENT' },
        { accountID: 'account-1200', code: '1200', name: 'Accounts Receivable', type: 'CURRENT' },
        { accountID: 'account-4000', code: '4000', name: 'Revenue', type: 'REVENUE' },
      ],
    }),
    getContacts: jest.fn().mockResolvedValue({
      contacts: [
        { contactID: 'contact-cash', name: 'Cash Customer' },
      ],
    }),
  },
}

export function resetXeroMocks() {
  mockXeroClient.accountingApi.createInvoices.mockClear()
  mockXeroClient.accountingApi.createPayments.mockClear()
  mockXeroClient.accountingApi.getAccounts.mockClear()
  mockXeroClient.accountingApi.getContacts.mockClear()
}







