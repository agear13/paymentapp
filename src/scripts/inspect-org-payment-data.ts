import { config } from 'dotenv';
import { resolve } from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../.env.local') });
const prisma = new PrismaClient();

const ORG_ID = '3ceced89-d5ef-41e9-b03b-a1d25c883768';

async function main() {
  const ms = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM merchant_settings WHERE organization_id = ${ORG_ID}::uuid LIMIT 1
  `;
  console.log('Merchant settings:', JSON.stringify(ms[0], null, 2));

  const singleRail = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT short_code, status, payment_method, description
    FROM payment_links
    WHERE organization_id = ${ORG_ID}::uuid AND payment_method IS NOT NULL
    ORDER BY created_at DESC NULLS LAST LIMIT 5
  `;
  console.log('\nSingle-rail links:', JSON.stringify(singleRail, null, 2));

  const paid = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT pl.short_code, pl.status, pl.payment_method, pe.payment_method AS event_method, pe.token_type, pe.amount_received
    FROM payment_links pl
    LEFT JOIN payment_events pe ON pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
    WHERE pl.organization_id = ${ORG_ID}::uuid AND pl.status = 'PAID'
    ORDER BY pl.updated_at DESC NULLS LAST LIMIT 5
  `;
  console.log('\nPaid links:', JSON.stringify(paid, null, 2));

  const xero = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%xero%'
    ORDER BY table_name
  `;
  console.log('\nXero tables:', xero.map((t) => t.table_name));

  if (paid.length > 0 && paid[0]?.id) {
    const sync = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM xero_sync_queue
      WHERE payment_link_id = ${paid[0].id as string}::uuid
      ORDER BY created_at DESC LIMIT 3
    `.catch(() => []);
    console.log('\nXero sync for latest paid:', JSON.stringify(sync, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
