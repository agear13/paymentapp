import fs from 'node:fs';
import { execSync } from 'node:child_process';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const files = execSync('rg -l "getCurrentUser\\(" app/api --glob "*.ts"', { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

const importLine =
  "import { getCurrentUserForApi } from '@/lib/auth/api-session.server';\n";

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const chunks = content.split(/(?=export async function )/);
  let changed = false;

  const updated = chunks.map((chunk) => {
    const methodMatch = chunk.match(/^export async function (GET|POST|PUT|PATCH|DELETE)\b/);
    if (!methodMatch || !MUTATING.has(methodMatch[1])) return chunk;
    if (!chunk.includes('getCurrentUser()')) return chunk;

    let next = chunk
      .replace(
        /const user = await getCurrentUser\(\);\s*\n\s*if \(!user\) \{\s*\n\s*return apiError\('Unauthorized', 401\);\s*\n\s*\}/g,
        "const auth = await getCurrentUserForApi(request);\n  if (!auth.user) return auth.response!;\n  const user = auth.user;"
      )
      .replace(
        /const user = await getCurrentUser\(\)\s*\n\s*if \(!user\) \{\s*\n\s*return apiError\('Unauthorized', 401\);\s*\n\s*\}/g,
        "const auth = await getCurrentUserForApi(request);\n  if (!auth.user) return auth.response!;\n  const user = auth.user;"
      )
      .replace(
        /const user = await getCurrentUser\(\);\s*\n\s*if \(!user\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);\s*\n\s*\}/g,
        "const auth = await getCurrentUserForApi(request);\n    if (!auth.user) return auth.response!;\n    const user = auth.user;"
      );

    // POST() without request param
    if (/export async function POST\(\)/.test(next)) {
      next = next.replace(/export async function POST\(\)/, 'export async function POST(request: NextRequest)');
    }

    // PUT(req) -> ensure NextRequest type if needed
    if (next.includes('getCurrentUserForApi') && next !== chunk) {
      changed = true;
    }
    return next;
  });

  if (!changed) continue;

  content = updated.join('');
  if (!content.includes("getCurrentUserForApi")) continue;
  if (!content.includes("from '@/lib/auth/api-session.server'")) {
    const sessionImport = content.match(/import \{ getCurrentUser \} from '@\/lib\/auth\/session';/);
    if (sessionImport) {
      content = content.replace(sessionImport[0], `${sessionImport[0]}\n${importLine.trim()}`);
    } else {
      content = importLine + content;
    }
  }
  if (!content.includes('NextRequest') && content.includes('getCurrentUserForApi')) {
    content = content.replace(
      /import \{ NextRequest/,
      "import { NextRequest"
    );
    if (!content.includes("import { NextRequest")) {
      content = "import { NextRequest } from 'next/server';\n" + content;
    }
  }

  fs.writeFileSync(file, content);
  console.log('migrated', file);
}
