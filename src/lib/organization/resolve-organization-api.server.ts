import 'server-only';

import { NextResponse } from 'next/server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import {
  isValidOrganizationUuid,
  warnInvalidOrganizationId,
} from './organization-id';

type ResolveSessionOrgResult =
  | { organizationId: string; response: null }
  | { organizationId: null; response: NextResponse };

/**
 * Resolve the authenticated user's workspace organization id from the session.
 * If `clientOrganizationId` is provided, it must be a UUID and match the session org.
 */
export async function resolveSessionOrganizationId(
  userId: string,
  clientOrganizationId?: string | null,
  context = 'api'
): Promise<ResolveSessionOrgResult> {
  const org = await getOrganizationForAuthenticatedUser(userId);
  if (!org) {
    return {
      organizationId: null,
      response: NextResponse.json(
        { error: 'No organization found for user', code: 'ORGANIZATION_NOT_FOUND' },
        { status: 404 }
      ),
    };
  }

  const sessionOrgId = org.id;

  if (clientOrganizationId) {
    if (!isValidOrganizationUuid(clientOrganizationId)) {
      warnInvalidOrganizationId(clientOrganizationId, context);
      return {
        organizationId: null,
        response: NextResponse.json(
          {
            error: 'Invalid organization_id: must be a UUID',
            code: 'INVALID_ORGANIZATION_ID',
          },
          { status: 400 }
        ),
      };
    }

    if (clientOrganizationId !== sessionOrgId) {
      warnInvalidOrganizationId(
        clientOrganizationId,
        `${context}: does not match session org ${sessionOrgId}`
      );
      return {
        organizationId: null,
        response: NextResponse.json(
          {
            error: 'organization_id does not match authenticated workspace',
            code: 'ORGANIZATION_MISMATCH',
          },
          { status: 403 }
        ),
      };
    }
  }

  return { organizationId: sessionOrgId, response: null };
}

/**
 * Parse and validate a UUID organization id query/body parameter.
 */
export function parseOrganizationIdParam(
  value: string | null | undefined,
  paramName = 'organization_id',
  context?: string
): { organizationId: string | null; response: NextResponse | null } {
  if (!value) {
    return {
      organizationId: null,
      response: NextResponse.json(
        { error: `Missing ${paramName} parameter`, code: 'MISSING_ORGANIZATION_ID' },
        { status: 400 }
      ),
    };
  }

  if (!isValidOrganizationUuid(value)) {
    warnInvalidOrganizationId(value, context ?? paramName);
    return {
      organizationId: null,
      response: NextResponse.json(
        {
          error: `Invalid ${paramName}: must be a UUID`,
          code: 'INVALID_ORGANIZATION_ID',
        },
        { status: 400 }
      ),
    };
  }

  return { organizationId: value, response: null };
}
