/**
 * Writes supabase/templates from the in-repo auth email source of truth.
 * Run from src/: npx tsx scripts/write-supabase-auth-email-templates.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_AUTH_EMAIL_TEMPLATES } from '../lib/auth/supabase-auth-email-templates';
import { SUPABASE_AUTH_EMAIL_SUBJECTS } from '../lib/auth/production-auth-branding';

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/templates');

for (const [name, html] of Object.entries(SUPABASE_AUTH_EMAIL_TEMPLATES)) {
  writeFileSync(join(templatesDir, `${name}.html`), html);
}

writeFileSync(join(templatesDir, 'subjects.json'), `${JSON.stringify(SUPABASE_AUTH_EMAIL_SUBJECTS, null, 2)}\n`);
