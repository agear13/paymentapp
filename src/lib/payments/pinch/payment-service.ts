/**
 * Pinch Payments — scheduled payment creation.
 *
 * Wraps PinchClient for POST /payments (Create or Update Payment).
 * Domain callers supply a typed request; this service maps it to the Pinch API
 * and returns the full API response unchanged.
 */

import { PinchClient } from '@/lib/payments/pinch/client';

/** Pinch "Create or Update Payment" — schedules a payment for a future transaction date. */
const CREATE_PAYMENT_ENDPOINT = '/payments';

export interface PinchCreatePaymentRequest {
  /** Pinch payer ID (`pyr_…`). */
  payerId: string;
  /** Payment amount in cents. */
  amount: number;
  /** Date to attempt the transaction (`YYYY-MM-DD`). */
  transactionDate: string;
  /** When set, updates an existing payment instead of creating one. */
  id?: string;
  /** Optional description visible to the payer (max 1000 characters). */
  description?: string;
  /** Idempotency nonce — string or array of strings. */
  nonce?: string | string[];
  /** Payment source ID (`src_…`). Uses the payer's first valid source when omitted. */
  sourceId?: string;
  /** Source types to surcharge, e.g. `['bank-account', 'credit-card']`. */
  surcharge?: string[];
  /** Optional fee in cents for the parent merchant (managed merchants only). */
  applicationFee?: number;
}

export interface PinchPaymentFees {
  transactionFee: number;
  applicationFee: number;
  totalFee: number;
  currency: string;
  taxRate: number;
  convertedTransactionFee: number | null;
  convertedApplicationFee: number | null;
  convertedTotalFee: number | null;
  convertedCurrency: string | null;
  conversionRate: number | null;
}

export interface PinchPaymentSource {
  id: string;
  sourceType: string;
  bankAccountNumber: string | null;
  bankAccountBsb: string | null;
  bankAccountName: string | null;
  creditCardToken: string | null;
  cardHolderName: string | null;
  expiryDate: string | null;
  displayCardNumber: string | null;
  cardScheme: string | null;
  origin: string | null;
  funding: string | null;
}

export interface PinchPaymentAttempt {
  id: string;
  amount: number;
  currency: string;
  convertedAmount: number | null;
  conversionRate: number | null;
  convertedCurrency: string | null;
  estimatedSettlementDate: string | null;
  isSurcharged: boolean;
  transactionDate: string;
  estimatedTransferDate: string | null;
  actualTransferDate: string | null;
  source: PinchPaymentSource;
  dishonour: unknown | null;
  settlement: unknown | null;
  fees: PinchPaymentFees;
  status: string;
}

export interface PinchPaymentPayer {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  mobileNumber: string | null;
  streetAddress: string | null;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  country: string | null;
  companyName: string | null;
  companyRegistrationNumber: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PinchCreatePaymentResponse {
  id: string;
  attemptId: string;
  amount: number;
  currency: string;
  description: string | null;
  applicationFee: number;
  totalFee: number;
  isSurcharged: boolean;
  sourceType: string;
  transactionDate: string;
  status: string;
  estimatedTransferDate: string | null;
  actualTransferDate: string | null;
  payer: PinchPaymentPayer;
  subscription: unknown | null;
  attempts: PinchPaymentAttempt[];
  metadata: Record<string, unknown> | null;
}

type PinchCreatePaymentApiBody = {
  payerId: string;
  amount: number;
  transactionDate: string;
  id?: string;
  description?: string;
  nonce?: string | string[];
  sourceId?: string;
  surcharge?: string[];
  applicationFee?: number;
};

function mapCreatePaymentRequest(request: PinchCreatePaymentRequest): PinchCreatePaymentApiBody {
  const body: PinchCreatePaymentApiBody = {
    payerId: request.payerId,
    amount: request.amount,
    transactionDate: request.transactionDate,
  };

  if (request.id !== undefined) {
    body.id = request.id;
  }
  if (request.description !== undefined) {
    body.description = request.description;
  }
  if (request.nonce !== undefined) {
    body.nonce = request.nonce;
  }
  if (request.sourceId !== undefined) {
    body.sourceId = request.sourceId;
  }
  if (request.surcharge !== undefined) {
    body.surcharge = request.surcharge;
  }
  if (request.applicationFee !== undefined) {
    body.applicationFee = request.applicationFee;
  }

  return body;
}

export class PinchPaymentService {
  private readonly client: PinchClient;

  constructor(client: PinchClient) {
    this.client = client;
  }

  /** Creates a client-backed service using validated environment configuration. */
  static fromEnv(): PinchPaymentService {
    return new PinchPaymentService(PinchClient.fromEnv());
  }

  /**
   * Creates or updates a scheduled Pinch payment via POST /payments.
   * @throws {PinchApiError} When the Pinch API returns a non-success response.
   */
  async createPayment(request: PinchCreatePaymentRequest): Promise<PinchCreatePaymentResponse> {
    return this.client.post<PinchCreatePaymentResponse>(
      CREATE_PAYMENT_ENDPOINT,
      mapCreatePaymentRequest(request),
    );
  }
}
