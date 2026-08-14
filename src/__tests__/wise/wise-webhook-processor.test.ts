import { processWiseWebhookPayload } from '@/lib/wise/wise-webhook-processor.server';

import { buildWiseTransferSettlementKey } from '@/lib/wise/wise-incoming-payment-correlation';

import { resolveSettlementAccount } from '@/lib/accounting/settlement-account-resolver';

import { WISE_HOLDING } from '@/lib/accounting/settlement-account-config';



jest.mock('@/lib/server/prisma', () => ({

  prisma: {

    payment_events: {

      findFirst: jest.fn(),

      create: jest.fn(),

    },

    payment_links: {

      findFirst: jest.fn(),

      update: jest.fn(),

    },

    merchant_settings: {

      findFirst: jest.fn(),

    },

  },

}));



jest.mock('@/lib/services/payment-confirmation', () => ({

  confirmPayment: jest.fn(),

}));



jest.mock('@/lib/pilot/wise-auto-settlement', () => ({

  isWiseAutoSettlementAvailable: jest.fn(),

}));



jest.mock('@/lib/wise/wise-balance-statement', () => ({

  fetchCustomerPaymentReferenceForTransfer: jest.fn(),

}));



const { prisma } = jest.requireMock('@/lib/server/prisma');

const { confirmPayment } = jest.requireMock('@/lib/services/payment-confirmation');

const { isWiseAutoSettlementAvailable } = jest.requireMock('@/lib/pilot/wise-auto-settlement');

const { fetchCustomerPaymentReferenceForTransfer } = jest.requireMock(

  '@/lib/wise/wise-balance-statement'

);



const openLink = {

  id: 'link-1',

  short_code: 'Ab12Cd34',

  status: 'OPEN',

  amount: 150,

  currency: 'AUD',

  invoice_currency: 'AUD',

  payment_method: 'WISE',

  organization_id: 'org-1',

  wise_status: 'INSTRUCTIONS_READY',

};



describe('processWiseWebhookPayload', () => {

  beforeEach(() => {

    jest.clearAllMocks();

    isWiseAutoSettlementAvailable.mockReturnValue(true);

    prisma.payment_events.findFirst.mockResolvedValue(null);

    prisma.payment_events.create.mockResolvedValue({ id: 'evt-1' });

    prisma.payment_links.update.mockResolvedValue({});

    confirmPayment.mockResolvedValue({ success: true, paymentEventId: 'confirmed-1' });

  });



  it('ignores webhooks when auto-settlement is disabled', async () => {

    isWiseAutoSettlementAvailable.mockReturnValue(false);



    const result = await processWiseWebhookPayload(

      { event_type: 'account-details-payment#state-change' },

      'corr-1'

    );



    expect(result.processed).toBe(false);

    expect(confirmPayment).not.toHaveBeenCalled();

  });



  it('A: confirms account-details COMPLETED pay-in after statement lookup', async () => {

    fetchCustomerPaymentReferenceForTransfer.mockResolvedValue({

      paymentReference: 'PROVVY-Ab12Cd34',

      statementTransaction: { referenceNumber: 'TRANSFER-36454' },

      wiseTransferReferenceNumber: 'TRANSFER-36454',

    });

    prisma.payment_links.findFirst.mockResolvedValue(openLink);

    prisma.merchant_settings.findFirst.mockResolvedValue({

      wise_profile_id: '999',

      wise_enabled: true,

    });



    const result = await processWiseWebhookPayload(

      {

        event_type: 'account-details-payment#state-change',

        delivery_id: 'delivery-ad-1',

        data: {

          resource: { id: 64, profile_id: 999, type: 'balance-account' },

          transfer: { id: 36454, amount: 150, currency: 'AUD' },

          current_state: 'COMPLETED',

          occurred_at: '2026-08-14T10:00:00.000Z',

        },

      },

      'corr-2'

    );



    expect(result.processed).toBe(true);

    expect(fetchCustomerPaymentReferenceForTransfer).toHaveBeenCalledWith(

      expect.objectContaining({ transferId: 36454, balanceId: 64, profileId: 999 })

    );

    expect(confirmPayment).toHaveBeenCalledWith(

      expect.objectContaining({

        paymentLinkId: 'link-1',

        provider: 'wise',

        providerRef: buildWiseTransferSettlementKey('36454'),

        transactionId: '36454',

        amountReceived: 150,

        currencyReceived: 'AUD',

      })

    );

  });



  it('B: does not confirm PROCESSING account-details payment', async () => {

    const result = await processWiseWebhookPayload(

      {

        event_type: 'account-details-payment#state-change',

        data: {

          resource: { id: 64, profile_id: 999 },

          transfer: { id: 36454, amount: 150, currency: 'AUD' },

          current_state: 'PROCESSING',

        },

      },

      'corr-3'

    );



    expect(result.processed).toBe(false);

    expect(fetchCustomerPaymentReferenceForTransfer).not.toHaveBeenCalled();

    expect(confirmPayment).not.toHaveBeenCalled();

  });



  it('C: ignores balances#update with BNK internal reference', async () => {

    const result = await processWiseWebhookPayload(

      {

        event_type: 'balances#update',

        delivery_id: 'delivery-bal-1',

        data: {

          resource: { profile_id: 999 },

          amount: 150,

          currency: 'AUD',

          transaction_type: 'credit',

          transfer_reference: 'BNK-1234567',

        },

      },

      'corr-4'

    );



    expect(result.processed).toBe(false);

    expect(confirmPayment).not.toHaveBeenCalled();

  });



  it('J: skips duplicate webhook delivery', async () => {

    prisma.payment_events.findFirst.mockImplementation(({ where }: { where: { OR: unknown[] } }) => {

      const orClauses = where.OR as Array<{ correlation_id?: string }>;

      if (orClauses.some((clause) => clause.correlation_id === 'wise:delivery:delivery-dup')) {

        return Promise.resolve({ id: 'existing' });

      }

      return Promise.resolve(null);

    });



    fetchCustomerPaymentReferenceForTransfer.mockResolvedValue({

      paymentReference: 'PROVVY-Ab12Cd34',

      statementTransaction: {},

      wiseTransferReferenceNumber: 'TRANSFER-36454',

    });

    prisma.payment_links.findFirst.mockResolvedValue(openLink);

    prisma.merchant_settings.findFirst.mockResolvedValue({

      wise_profile_id: '999',

      wise_enabled: true,

    });



    const result = await processWiseWebhookPayload(

      {

        event_type: 'account-details-payment#state-change',

        delivery_id: 'delivery-dup',

        data: {

          resource: { id: 64, profile_id: 999 },

          transfer: { id: 36454, amount: 150, currency: 'AUD' },

          current_state: 'COMPLETED',

        },

      },

      'corr-5'

    );



    expect(result.reason).toBe('duplicate_event');

    expect(confirmPayment).not.toHaveBeenCalled();

  });



  it('J: skips duplicate transfer settlement across event types', async () => {

    prisma.payment_events.findFirst.mockImplementation(({ where }: { where: { OR: unknown[] } }) => {

      const orClauses = where.OR as Array<{ correlation_id?: string; wise_transfer_id?: string }>;

      if (

        orClauses.some(

          (clause) =>

            clause.correlation_id === buildWiseTransferSettlementKey('36454') ||

            clause.wise_transfer_id === '36454'

        )

      ) {

        return Promise.resolve({ id: 'settled' });

      }

      return Promise.resolve(null);

    });



    const result = await processWiseWebhookPayload(

      {

        event_type: 'account-details-payment#state-change',

        delivery_id: 'delivery-new',

        data: {

          resource: { id: 64, profile_id: 999 },

          transfer: { id: 36454, amount: 150, currency: 'AUD' },

          current_state: 'COMPLETED',

        },

      },

      'corr-6'

    );



    expect(result.reason).toBe('duplicate_transfer_settlement');

    expect(confirmPayment).not.toHaveBeenCalled();

  });



  it('L: confirms SWIFT credit with PROVVY reference in payload', async () => {

    prisma.payment_links.findFirst.mockResolvedValue(openLink);

    prisma.merchant_settings.findFirst.mockResolvedValue({

      wise_profile_id: '999',

      wise_enabled: true,

    });



    const result = await processWiseWebhookPayload(

      {

        event_type: 'swift-in#credit',

        delivery_id: 'delivery-swift',

        data: {

          action: { id: 12345, profile_id: 999 },

          resource: {

            reference: 'PROVVY-Ab12Cd34',

            settled_amount: { value: 150, currency: 'AUD' },

          },

        },

      },

      'corr-7'

    );



    expect(result.processed).toBe(true);

    expect(confirmPayment).toHaveBeenCalledWith(

      expect.objectContaining({

        providerRef: buildWiseTransferSettlementKey('12345'),

      })

    );

  });



  it('M: does not confirm SWIFT without reference', async () => {

    const result = await processWiseWebhookPayload(

      {

        event_type: 'swift-in#credit',

        data: {

          action: { id: 12345, profile_id: 999 },

          resource: { settled_amount: { value: 150, currency: 'AUD' } },

        },

      },

      'corr-8'

    );



    expect(result.processed).toBe(false);

    expect(result.reason).toBe('missing_customer_reference');

    expect(confirmPayment).not.toHaveBeenCalled();

  });

});



describe('Wise Xero settlement routing (O/P)', () => {

  it('O: resolves Wise payments to Wise Holding 1055', () => {

    const resolution = resolveSettlementAccount({

      paymentRail: 'wise',

      settings: { xero_wise_clearing_account_id: '1055' },

    });



    expect(resolution.status).toBe('resolved');

    if (resolution.status === 'resolved') {

      expect(resolution.xeroAccountCode).toBe('1055');

      expect(resolution.target.accountName).toBe(WISE_HOLDING.accountName);

    }

  });



  it('P: missing Wise Holding mapping stays unresolved — not Stripe/USDC', () => {

    const wiseResolution = resolveSettlementAccount({

      paymentRail: 'wise',

      settings: {

        xero_stripe_clearing_account_id: '1050',

        xero_usdc_clearing_account_id: '1052',

      },

    });

    expect(wiseResolution.status).toBe('unmapped');



    const stripeResolution = resolveSettlementAccount({

      paymentRail: 'stripe',

      settings: { xero_stripe_clearing_account_id: '1050' },

    });

    expect(stripeResolution.status).toBe('resolved');

    if (stripeResolution.status === 'resolved') {

      expect(stripeResolution.xeroAccountCode).toBe('1050');

    }

  });

});


