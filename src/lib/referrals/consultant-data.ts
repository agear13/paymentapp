/**
 * Server-only: Fetches consultant dashboard data.
 * Uses admin client; caller must verify auth (consultant owns data).
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface AdvocateWithMetrics {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  custom_commission_percent: number;
  status: string;
  clicks: number;
  conversions: number;
  totalEarnings: number;
  lastActivity: string | null;
}

export interface EarningsRow {
  id: string;
  source_ref: string;
  gross_amount: number | null;
  earnings_amount: number;
  currency: string;
  status: string;
  created_at: string;
  sourceType: 'advocate' | 'direct';
}

export interface ConsultantDashboardData {
  bdPartnerName: string;
  ownerPercent: number;
  advocates: AdvocateWithMetrics[];
  earnings: EarningsRow[];
}

export async function getConsultantDashboardData(
  consultantParticipantId: string,
  programId: string
): Promise<ConsultantDashboardData> {
  const admin = createAdminClient();

  const { data: program } = await admin
    .from('referral_programs')
    .select('owner_percent, owner_participant_id')
    .eq('id', programId)
    .single();

  const ownerPercent = parseFloat(String(program?.owner_percent ?? 0));
  let bdPartnerName = 'your training partner';

  if (program?.owner_participant_id) {
    const { data: owner } = await admin
      .from('referral_participants')
      .select('name')
      .eq('id', program.owner_participant_id)
      .single();
    if (owner?.name) bdPartnerName = owner.name;
  }

  const { data: advocates } = await admin
    .from('referral_participants')
    .select('id, name, email, referral_code, custom_commission_percent, status')
    .eq('parent_participant_id', consultantParticipantId)
    .eq('role', 'CLIENT_ADVOCATE')
    .eq('status', 'active');

  const advocatesWithMetrics: AdvocateWithMetrics[] = [];

  for (const adv of advocates || []) {
    const { count: clicks } = await admin
      .from('referral_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', adv.id);

    const { count: conversions } = await admin
      .from('referral_conversions')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', adv.id)
      .eq('conversion_type', 'payment_completed');

    const { data: lastAttr } = await admin
      .from('referral_attributions')
      .select('created_at')
      .eq('participant_id', adv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: mapRow } = await admin
      .from('referral_partner_entity_map')
      .select('partner_entity_id')
      .eq('referral_participant_id', adv.id)
      .single();

    let totalEarnings = 0;
    if (mapRow) {
      const { data: entries } = await admin
        .from('partner_ledger_entries')
        .select('earnings_amount')
        .eq('entity_id', mapRow.partner_entity_id)
        .eq('source', 'referral');
      totalEarnings = (entries || []).reduce((s, e) => s + parseFloat(String(e.earnings_amount || 0)), 0);
    }

    advocatesWithMetrics.push({
      ...adv,
      custom_commission_percent: parseFloat(String(adv.custom_commission_percent ?? 0)),
      clicks: clicks ?? 0,
      conversions: conversions ?? 0,
      totalEarnings,
      lastActivity: lastAttr?.created_at ?? null,
    });
  }

  const { data: consultantMap } = await admin
    .from('referral_partner_entity_map')
    .select('partner_entity_id')
    .eq('referral_participant_id', consultantParticipantId)
    .single();

  const earnings: EarningsRow[] = [];
  if (consultantMap) {
    const { data: entries } = await admin
      .from('partner_ledger_entries')
      .select('id, source_ref, gross_amount, earnings_amount, currency, status, created_at')
      .eq('entity_id', consultantMap.partner_entity_id)
      .eq('source', 'referral')
      .order('created_at', { ascending: false })
      .limit(50);

    const sourceRefs = (entries || []).map((e) => e.source_ref).filter(Boolean);
    const advocateIds = new Set((advocates || []).map((a) => a.id));

    let convMap: Record<string, string> = {};
    if (sourceRefs.length > 0) {
      const { data: convs } = await admin
        .from('referral_conversions')
        .select('id, participant_id')
        .in('id', sourceRefs);
      convMap = (convs || []).reduce((acc, c) => ({ ...acc, [c.id]: c.participant_id }), {});
    }

    for (const e of entries || []) {
      const convParticipantId = convMap[e.source_ref];
      const sourceType: 'advocate' | 'direct' =
        convParticipantId && convParticipantId !== consultantParticipantId && advocateIds.has(convParticipantId)
          ? 'advocate'
          : 'direct';

      earnings.push({
        ...e,
        gross_amount: e.gross_amount != null ? parseFloat(String(e.gross_amount)) : null,
        earnings_amount: parseFloat(String(e.earnings_amount)),
        sourceType,
      });
    }
  }

  return {
    bdPartnerName,
    ownerPercent,
    advocates: advocatesWithMetrics,
    earnings,
  };
}
