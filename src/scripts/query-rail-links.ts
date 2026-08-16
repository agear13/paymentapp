import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../.env.local') });
const prisma = new PrismaClient();
const ORG = '3ceced89-d5ef-41e9-b03b-a1d25c883768';

async function main() {
  const single = await prisma.$queryRaw<Array<{ short_code: string; payment_method: string; status: string }>>`
    SELECT short_code, payment_method::text, status::text
    FROM payment_links
    WHERE organization_id = ${ORG}::uuid AND payment_method IS NOT NULL
    ORDER BY created_at DESC NULLS LAST LIMIT 5
  `;
  console.log('single-rail', JSON.stringify(single));

  const customerChoice = await prisma.$queryRaw<Array<{ short_code: string; payment_method: string | null }>>`
    SELECT short_code, payment_method::text
    FROM payment_links
    WHERE organization_id = ${ORG}::uuid AND payment_method IS NULL AND invoice_only_mode = false
    ORDER BY created_at DESC NULLS LAST LIMIT 3
  `;
  console.log('customer-choice', JSON.stringify(customerChoice));
}

main().finally(() => prisma.$disconnect());
