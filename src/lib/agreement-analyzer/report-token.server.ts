import 'server-only';

import { randomBytes } from 'crypto';

const TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_SUFFIX_LENGTH = 10;

export function generateReportAccessToken(): string {
  const bytes = randomBytes(TOKEN_SUFFIX_LENGTH);
  let suffix = '';
  for (let i = 0; i < TOKEN_SUFFIX_LENGTH; i++) {
    suffix += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  }
  return `rpt_${suffix}`;
}
