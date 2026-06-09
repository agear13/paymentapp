import 'server-only';

import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

export function isValidInternalAdminRequest(request: NextRequest): boolean {
  const adminToken = process.env.INTERNAL_ADMIN_TOKEN?.trim();
  const headerToken = request.headers.get('x-internal-admin-token')?.trim();
  if (!adminToken || !headerToken) return false;

  const provided = Buffer.from(headerToken);
  const expected = Buffer.from(adminToken);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
