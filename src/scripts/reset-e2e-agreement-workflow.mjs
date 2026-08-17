/**
 * Resets Agreement Intelligence workflow agreement state for the E2E user org.
 * Local E2E only — requires DATABASE_URL and E2E_EMAIL.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '..', '.env.local') });

const email = process.env.E2E_EMAIL?.trim();
if (!email) {
  console.error('E2E_EMAIL is required');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for workflow reset');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const userRows = await prisma.$queryRaw`
    SELECT id::text AS id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1
  `;
  const userId = userRows[0]?.id;
  if (!userId) {
    throw new Error(`No auth.users row for E2E_EMAIL=${email}. Run npm run e2e:setup-auth-db first.`);
  }

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'asc' },
  });
  if (!membership) {
    throw new Error(`No organization membership for E2E user ${email}`);
  }

  const workflow = await prisma.organization_workflows.findUnique({
    where: {
      ux_organization_workflows_org_template: {
        organization_id: membership.organization_id,
        template_slug: 'agreement-intelligence',
      },
    },
    include: { agreement: true },
  });

  if (!workflow) {
    console.log('Agreement Intelligence not installed — nothing to reset.');
    process.exit(0);
  }

  if (workflow.agreement) {
    await prisma.organization_workflow_agreements.update({
      where: { id: workflow.agreement.id },
      data: {
        source_type: 'PASTE',
        title: null,
        original_filename: null,
        mime_type: null,
        file_size_bytes: null,
        storage_key: null,
        source_text: null,
        extraction_status: 'PENDING',
        extraction_result: null,
        commercial_graph: null,
        approved_structure: null,
        extraction_error: null,
        extracted_at: null,
        approved_at: null,
        approved_by_user_id: null,
        pilot_deal_id: null,
        bootstrap_error: null,
        bootstrapped_at: null,
      },
    });
  }

  await prisma.organization_workflows.update({
    where: { id: workflow.id },
    data: { lifecycle_status: 'AWAITING_INPUT' },
  });

  console.log(`Reset Agreement Intelligence workflow ${workflow.id} to AWAITING_INPUT for ${email}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
