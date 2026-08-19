import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { prisma } from '@/lib/server/prisma';
import {
  countVerifiedTotpFactors,
  type AmrEntry,
} from '@/lib/auth/mfa-assurance';

const RECOVERY_CODE_COUNT = 8;

export type TotpFactorSummary = {
  id: string;
  status: string;
  friendlyName: string | null;
};

export type MfaAssuranceSnapshot = {
  currentLevel: string | null;
  nextLevel: string | null;
  methods: AmrEntry[];
  verifiedTotpCount: number;
  totpFactors: TotpFactorSummary[];
};

function totpFactorsFromAdminList(
  data:
    | {
        totp?: Array<{ id: string; status: string; factor_type?: string }>;
        factors?: Array<{ id: string; status: string; factor_type?: string }>;
      }
    | null
    | undefined
): Array<{ id: string; status: string; factor_type?: string }> {
  if (!data) return [];
  if (Array.isArray(data.totp)) return data.totp;
  if (Array.isArray(data.factors)) {
    return data.factors.filter(
      (factor) => factor.factor_type === 'totp' || !factor.factor_type
    );
  }
  return [];
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function formatRecoveryCode(bytes: Buffer): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  for (let i = 0; i < 8; i += 1) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export const getMfaAssuranceSnapshot = cache(async (): Promise<MfaAssuranceSnapshot> => {
  const supabase = await createClient();

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  const totp = factors?.totp ?? [];
  const methods = (aal?.currentAuthenticationMethods ?? []) as AmrEntry[];

  return {
    currentLevel: aal?.currentLevel ?? null,
    nextLevel: aal?.nextLevel ?? null,
    methods,
    verifiedTotpCount: countVerifiedTotpFactors(
      totp.map((factor) => ({ factor_type: 'totp', status: factor.status }))
    ),
    totpFactors: totp.map((factor) => ({
      id: factor.id,
      status: factor.status,
      friendlyName: factor.friendly_name ?? null,
    })),
  };
});

export async function userHasVerifiedTotp(userId?: string): Promise<boolean> {
  if (userId) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
      if (error) {
        const snapshot = await getMfaAssuranceSnapshot();
        return snapshot.verifiedTotpCount > 0;
      }
      const totp = totpFactorsFromAdminList(data);
      return countVerifiedTotpFactors(
        totp.map((factor) => ({ factor_type: 'totp', status: factor.status }))
      ) > 0;
    } catch {
      const snapshot = await getMfaAssuranceSnapshot();
      return snapshot.verifiedTotpCount > 0;
    }
  }

  const snapshot = await getMfaAssuranceSnapshot();
  return snapshot.verifiedTotpCount > 0;
}

export async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes: string[] = [];
  const rows: { user_id: string; code_hash: string }[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const code = formatRecoveryCode(randomBytes(8));
    codes.push(code);
    rows.push({ user_id: userId, code_hash: hashRecoveryCode(code) });
  }

  await prisma.$transaction([
    prisma.user_mfa_recovery_codes.deleteMany({ where: { user_id: userId } }),
    prisma.user_mfa_recovery_codes.createMany({ data: rows }),
  ]);

  return codes;
}

export async function consumeRecoveryCode(
  userId: string,
  code: string
): Promise<boolean> {
  const incomingHash = hashRecoveryCode(code);
  const unused = await prisma.user_mfa_recovery_codes.findMany({
    where: { user_id: userId, used_at: null },
    select: { id: true, code_hash: true },
  });

  const match = unused.find((row) => {
    const stored = Buffer.from(row.code_hash, 'hex');
    const incoming = Buffer.from(incomingHash, 'hex');
    if (stored.length !== incoming.length) return false;
    return timingSafeEqual(stored, incoming);
  });

  if (!match) return false;

  const updated = await prisma.user_mfa_recovery_codes.updateMany({
    where: { id: match.id, used_at: null },
    data: { used_at: new Date() },
  });

  return updated.count === 1;
}

export async function deleteAllTotpFactorsForUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.mfa.listFactors({ userId });
  const totp = totpFactorsFromAdminList(data);
  await Promise.all(
    totp.map((factor) =>
      admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id })
    )
  );
}

export async function remainingUnusedRecoveryCodeCount(userId: string): Promise<number> {
  return prisma.user_mfa_recovery_codes.count({
    where: { user_id: userId, used_at: null },
  });
}
