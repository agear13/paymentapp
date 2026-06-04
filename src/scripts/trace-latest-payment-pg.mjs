import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

const urls = [
  process.env.DIRECT_DATABASE_URL,
  process.env.DATABASE_URL?.replace(':6543/', ':5432/').replace('pgbouncer=true&', '').replace('&connection_limit=1', ''),
  process.env.DATABASE_URL,
].filter(Boolean);

async function inspect(urlLabel, connectionString) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 25000 });
  try {
    await client.connect();

    const migrations = await client.query(`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 5
    `).catch(() => ({ rows: [] }));

    const cols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_links'
        AND column_name LIKE '%referral%' OR (
          table_schema = 'public' AND table_name = 'payment_links' AND column_name IN (
            'pilot_deal_id','attributed_participant_user_id','commission_attribution_snapshot','status'
          )
        )
    `);

    const confirmedCount = await client.query(`
      SELECT COUNT(*)::int AS c FROM payment_events WHERE event_type::text = 'PAYMENT_CONFIRMED'
    `);

    const latestConfirmed = await client.query(`
      SELECT pe.id, pe.payment_link_id, pe.created_at, pe.amount_received, pe.currency_received
      FROM payment_events pe
      WHERE pe.event_type::text = 'PAYMENT_CONFIRMED'
      ORDER BY pe.created_at DESC
      LIMIT 1
    `);

    return {
      urlLabel,
      ok: true,
      migrations: migrations.rows,
      referralColumns: cols.rows.map((r) => r.column_name),
      confirmedCount: confirmedCount.rows[0]?.c,
      latestConfirmed: latestConfirmed.rows[0] ?? null,
    };
  } catch (e) {
    return { urlLabel, ok: false, error: e.message };
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function tracePayment(connectionString, paymentEventId) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 25000 });
  await client.connect();

  const pe = await client.query(
    `SELECT * FROM payment_events WHERE id = $1`,
    [paymentEventId]
  );
  const linkId = pe.rows[0]?.payment_link_id;
  const link = linkId
    ? await client.query(`SELECT * FROM payment_links WHERE id = $1`, [linkId])
    : { rows: [] };

  const co = linkId
    ? await client.query(
        `SELECT * FROM commission_obligations WHERE payment_link_id = $1 OR stripe_event_id = $2`,
        [linkId, paymentEventId]
      )
    : { rows: [] };

  let items = [];
  if (co.rows[0]?.id) {
    const ir = await client.query(
      `SELECT * FROM commission_obligation_items WHERE commission_obligation_id = $1`,
      [co.rows[0].id]
    );
    items = ir.rows;
  }

  const pilotDealId = pe.rows[0]?.pilot_deal_id ?? link.rows[0]?.pilot_deal_id;
  let pilotObs = [];
  if (pilotDealId) {
    const pr = await client.query(
      `SELECT id, participant_id, amount_owed, status::text, payment_event_id, updated_at
       FROM deal_network_pilot_obligations WHERE deal_id = $1 ORDER BY updated_at DESC LIMIT 30`,
      [pilotDealId]
    );
    pilotObs = pr.rows;
  }

  await client.end();

  return {
    payment_event: pe.rows[0],
    payment_link: link.rows[0]
      ? {
          id: link.rows[0].id,
          short_code: link.rows[0].short_code,
          referral_link_id: link.rows[0].referral_link_id,
          attributed_participant_user_id: link.rows[0].attributed_participant_user_id,
          commission_attribution_snapshot: link.rows[0].commission_attribution_snapshot,
          pilot_deal_id: link.rows[0].pilot_deal_id,
          status: link.rows[0].status,
          attribution_referral_code: link.rows[0].attribution_referral_code,
        }
      : null,
    commission_obligations: co.rows,
    commission_obligation_items: items,
    deal_network_pilot_obligations: pilotObs,
  };
}

async function main() {
  const results = [];
  for (const [i, url] of urls.entries()) {
    results.push(await inspect(`url_${i}`, url));
  }
  console.log('INSPECT', JSON.stringify(results, null, 2));

  const working = urls.find((_, i) => results[i]?.ok && (results[i].confirmedCount ?? 0) > 0);
  const schemaOk = urls.find((_, i) => results[i]?.ok && results[i].referralColumns?.includes('referral_link_id'));

  const conn = working ?? schemaOk ?? urls[0];
  const latestId = results.find((r) => r.latestConfirmed)?.latestConfirmed?.id;

  if (!conn || !latestId) {
    console.log('NO_CONFIRMED_PAYMENT_IN_CONFIGURED_DATABASES');
    return;
  }

  const trace = await tracePayment(conn, latestId);
  console.log('TRACE', JSON.stringify(trace, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
}

main().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
