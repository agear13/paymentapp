/**
 * Trace commission propagation for a Stripe payment intent (production or local DATABASE_URL).
 * Usage: node scripts/trace-pi-attribution-chain.mjs pi_3TePrJR91Wfxx6ZH1Vvyggpp
 */
import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

const pi = process.argv[2]?.trim();
if (!pi) {
  console.error('Usage: node scripts/trace-pi-attribution-chain.mjs <stripe_payment_intent_id>');
  process.exit(1);
}

function pilotSlugFromParticipantId(id) {
  const compact = id.replace(/-/g, '').slice(0, 40);
  return `pilot-${compact}`.slice(0, 64);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
});

await client.connect();

const peRes = await client.query(
  `SELECT id, payment_link_id, event_type, stripe_payment_intent_id, amount_received, currency_received, created_at
   FROM payment_events WHERE stripe_payment_intent_id = $1 ORDER BY created_at DESC LIMIT 3`,
  [pi]
);

const pe = peRes.rows[0];
if (!pe) {
  console.log(JSON.stringify({ error: 'NO_PAYMENT_EVENT_FOR_PI', pi }, null, 2));
  await client.end();
  process.exit(0);
}

const linkRes = await client.query(`SELECT * FROM payment_links WHERE id = $1`, [pe.payment_link_id]);
const link = linkRes.rows[0];

const rlRes = link?.referral_link_id
  ? await client.query(`SELECT id, code, slug, organization_id FROM referral_links WHERE id = $1`, [
      link.referral_link_id,
    ])
  : { rows: [] };
const rl = rlRes.rows[0];

const coRes = await client.query(
  `SELECT co.*,
    (SELECT COUNT(*)::int FROM commission_obligation_items coi WHERE coi.commission_obligation_id = co.id) AS item_count
   FROM commission_obligations co
   WHERE co.payment_link_id = $1 OR co.stripe_event_id = $2`,
  [pe.payment_link_id, pe.id]
);

const coiRes = await client.query(
  `SELECT coi.* FROM commission_obligation_items coi
   JOIN commission_obligations co ON co.id = coi.commission_obligation_id
   WHERE co.payment_link_id = $1 OR co.stripe_event_id = $2`,
  [pe.payment_link_id, pe.id]
);

const ledgerRes = await client.query(
  `SELECT le.id, le.amount, le.entry_type, le.description, la.code, la.name
   FROM ledger_entries le
   JOIN ledger_accounts la ON la.id = le.ledger_account_id
   WHERE le.payment_link_id = $1 AND la.code IN ('6105','2130','2110')`,
  [pe.payment_link_id]
);

const orgId = link?.organization_id;
let attributionApiRows = [];
if (orgId) {
  const itemsRes = await client.query(
    `SELECT coi.id, coi.amount, coi.status, coi.currency, rl.slug, rl.code
     FROM commission_obligation_items coi
     JOIN commission_obligations co ON co.id = coi.commission_obligation_id
     JOIN payment_links pl ON pl.id = co.payment_link_id
     LEFT JOIN referral_links rl ON rl.id = co.referral_link_id
     WHERE pl.organization_id = $1`,
    [orgId]
  );

  let partsRes = { rows: [] };
  try {
    partsRes = await client.query(
      `SELECT p.id, p.name, p.deal_id, d.name AS deal_name
       FROM deal_network_pilot_participants p
       JOIN deal_network_pilot_deals d ON d.id = p.deal_id`,
      []
    );
  } catch {
    partsRes = { rows: [] };
  }

  const slugMap = new Map();
  for (const p of partsRes.rows) {
    slugMap.set(pilotSlugFromParticipantId(p.id), p);
  }

  const byParticipant = new Map();
  for (const row of itemsRes.rows) {
    const mapped = row.slug ? slugMap.get(row.slug) : null;
    const pid = mapped?.id ?? `unmapped-${row.slug ?? '?'}`;
    const name = mapped?.name ?? row.code ?? 'Attribution';
    const amt = parseFloat(row.amount);
    const cur = byParticipant.get(pid) ?? {
      participantId: pid,
      participantName: name,
      outstandingAmount: 0,
      paidAmount: 0,
      items: [],
    };
    if (row.status === 'PAID') cur.paidAmount += amt;
    else cur.outstandingAmount += amt;
    cur.items.push(row);
    byParticipant.set(pid, cur);
  }
  attributionApiRows = [...byParticipant.values()];
}

const stops = [];
if (pe.event_type !== 'PAYMENT_CONFIRMED') stops.push('NO_PAYMENT_CONFIRMED_EVENT');
if (!link?.referral_link_id) stops.push('PAYMENT_LINK_MISSING_REFERRAL_LINK_ID');
if (coRes.rows.length === 0) stops.push('NO_COMMISSION_OBLIGATIONS_ROW');
if (coRes.rows.length > 0 && coiRes.rows.length === 0) stops.push('NO_COMMISSION_OBLIGATION_ITEMS');
const dj = attributionApiRows.find((r) => r.participantName?.toLowerCase().includes('dj alex'));
if (coiRes.rows.length > 0 && !dj) stops.push('ATTRIBUTION_API_NO_DJ_ALEX_SLUG_MAP');

console.log(
  JSON.stringify(
    {
      database: process.env.DATABASE_URL?.includes('provvypay') ? 'likely_render' : 'other',
      payment_event: pe,
      payment_link: link
        ? {
            id: link.id,
            short_code: link.short_code,
            organization_id: link.organization_id,
            referral_link_id: link.referral_link_id,
            attributed_participant_user_id: link.attributed_participant_user_id,
            pilot_deal_id: link.pilot_deal_id,
          }
        : null,
      referral_link: rl,
      ledger_commission_entries: ledgerRes.rows,
      commission_obligations: coRes.rows,
      commission_obligation_items: coiRes.rows,
      attribution_earnings_api_simulation: attributionApiRows,
      dj_alex_in_api: dj ?? null,
      propagation_stops: stops,
      first_divergence_after_ledger:
        ledgerRes.rows.length > 0 ? stops[0] ?? 'CHAIN_COMPLETE_TO_UI' : 'NO_LEDGER_IN_THIS_DB',
    },
    null,
    2
  )
);

await client.end();
