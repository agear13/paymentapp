/**
 * Referral participant auth helpers
 * Uses user client for auth checks; participant data may come from user or admin client
 */

import { createUserClient } from '@/lib/supabase/server';

export interface AuthedParticipant {
  participant: {
    id: string;
    program_id: string;
    role: string;
    name: string;
    referral_code: string;
    parent_participant_id: string | null;
    custom_commission_percent: number | null;
    user_id: string | null;
  };
  program: {
    id: string;
    slug: string;
    name: string;
    owner_percent: number | null;
    owner_participant_id: string | null;
  };
}

/**
 * Get the authenticated participant for a program by user_id binding.
 * Uses user client for auth; requires participant.user_id = auth.uid().
 */
export async function getAuthedParticipantForProgram(
  programSlug: string
): Promise<AuthedParticipant | null> {
  const supabase = await createUserClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return null;
  }

  const { data: program, error: progError } = await supabase
    .from('referral_programs')
    .select('id, slug, name, owner_percent, owner_participant_id')
    .eq('slug', programSlug)
    .single();

  if (progError || !program) {
    return null;
  }

  const { data: participant, error: partError } = await supabase
    .from('referral_participants')
    .select('id, program_id, role, name, referral_code, parent_participant_id, custom_commission_percent, user_id')
    .eq('user_id', user.id)
    .eq('program_id', program.id)
    .eq('status', 'active')
    .maybeSingle();

  if (partError || !participant) {
    return null;
  }

  return {
    participant: {
      ...participant,
      parent_participant_id: participant.parent_participant_id ?? null,
      custom_commission_percent: participant.custom_commission_percent ?? null,
      user_id: participant.user_id ?? null,
    },
    program: {
      ...program,
      owner_percent: program.owner_percent ?? null,
      owner_participant_id: program.owner_participant_id ?? null,
    },
  };
}
