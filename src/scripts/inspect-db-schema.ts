import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../.env.local') });
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merchant_settings'
    ORDER BY ordinal_position
  `;
  console.log('merchant_settings columns:', cols.map((c) => c.column_name).join(', '));

  const links = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, short_code, status, payment_method, invoice_only_mode, amount, currency, organization_id, description
    FROM payment_links
    ORDER BY created_at DESC NULLS LAST
    LIMIT 10
  `;
  console.log('\nRecent payment links:');
  console.log(JSON.stringify(links, null, 2));
}

main().finally(() => prisma.$disconnect());
