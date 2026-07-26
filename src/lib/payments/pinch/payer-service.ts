/**
 * Pinch Payments — payer creation.
 *
 * Wraps PinchClient for POST /payers (Create or Update Payer).
 * Domain callers supply a typed request; this service maps it to the Pinch API
 * and returns the full API response unchanged.
 */

import { PinchClient } from '@/lib/payments/pinch/client';

/** Pinch "Create or Update Payer". */
const CREATE_PAYER_ENDPOINT = '/payers';

export interface PinchCreatePayerRequest {
  /** First name (required by Pinch). */
  firstName: string;
  /** Email address (required by Pinch). */
  emailAddress: string;
  /** When set, updates an existing payer instead of creating one. */
  id?: string;
  fullName?: string;
  lastName?: string;
  mobileNumber?: string;
  companyName?: string;
  companyRegistrationNumber?: string;
  streetAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  /** Free-form metadata stored against the payer (JSON string). */
  metadata?: string;
}

export interface PinchCreatePayerResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string | null;
  emailAddress: string;
  mobileNumber: string | null;
  streetAddress: string | null;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  country: string | null;
  companyName: string | null;
  companyRegistrationNumber: string | null;
  metadata: Record<string, unknown> | string | null;
}

type PinchCreatePayerApiBody = {
  firstName: string;
  emailAddress: string;
  id?: string;
  fullName?: string;
  lastName?: string;
  mobileNumber?: string;
  companyName?: string;
  companyRegistrationNumber?: string;
  streetAddress?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  metadata?: string;
};

function mapCreatePayerRequest(request: PinchCreatePayerRequest): PinchCreatePayerApiBody {
  const body: PinchCreatePayerApiBody = {
    firstName: request.firstName,
    emailAddress: request.emailAddress,
  };

  if (request.id !== undefined) {
    body.id = request.id;
  }
  if (request.fullName !== undefined) {
    body.fullName = request.fullName;
  }
  if (request.lastName !== undefined) {
    body.lastName = request.lastName;
  }
  if (request.mobileNumber !== undefined) {
    body.mobileNumber = request.mobileNumber;
  }
  if (request.companyName !== undefined) {
    body.companyName = request.companyName;
  }
  if (request.companyRegistrationNumber !== undefined) {
    body.companyRegistrationNumber = request.companyRegistrationNumber;
  }
  if (request.streetAddress !== undefined) {
    body.streetAddress = request.streetAddress;
  }
  if (request.suburb !== undefined) {
    body.suburb = request.suburb;
  }
  if (request.state !== undefined) {
    body.state = request.state;
  }
  if (request.postcode !== undefined) {
    body.postcode = request.postcode;
  }
  if (request.country !== undefined) {
    body.country = request.country;
  }
  if (request.metadata !== undefined) {
    body.metadata = request.metadata;
  }

  return body;
}

export class PinchPayerService {
  private readonly client: PinchClient;

  constructor(client: PinchClient) {
    this.client = client;
  }

  /** Creates a client-backed service using validated environment configuration. */
  static fromEnv(): PinchPayerService {
    return new PinchPayerService(PinchClient.fromEnv());
  }

  /**
   * Creates or updates a Pinch payer via POST /payers.
   * @throws {PinchApiError} When the Pinch API returns a non-success response.
   */
  async createPayer(request: PinchCreatePayerRequest): Promise<PinchCreatePayerResponse> {
    return this.client.post<PinchCreatePayerResponse>(
      CREATE_PAYER_ENDPOINT,
      mapCreatePayerRequest(request),
    );
  }
}
