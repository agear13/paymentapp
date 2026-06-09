import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve('app/api');
const output = execSync('rg -l "requireAuth\\(\\)" app/api --glob "*.ts"', { encoding: 'utf8' });
const files = output.trim().split(/\r?\n/).filter(Boolean);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('requireAuth()')) continue;

  content = content.replace(/(\b\w+\s*=\s*)?_request\b/g, (match, prefix) =>
    prefix ? `${prefix}request` : 'request'
  );

  content = content.replace(/export async function GET\(\)/g, 'export async function GET(request: Request)');

  const fnChunks = content.split(/(?=export async function )/);
  const rebuilt = fnChunks
    .map((chunk) => {
      if (!chunk.includes('requireAuth()')) return chunk;
      const usesReq = /export async function \w+\(\s*req\b/.test(chunk);
      const usesRequest = /export async function \w+\(\s*request\b/.test(chunk);
      if (usesReq && !usesRequest) {
        return chunk.replace(/await requireAuth\(\)/g, 'await requireAuth(req)');
      }
      return chunk.replace(/await requireAuth\(\)/g, 'await requireAuth(request)');
    })
    .join('');

  fs.writeFileSync(file, rebuilt);
  console.log('fixed', file);
}
