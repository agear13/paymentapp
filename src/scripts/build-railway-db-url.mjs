/**
 * Build Railway provvypay-db DATABASE_URL for local tooling.
 * Writes URL to stdout only — do not log stdout in chat.
 * Rewrites host to 127.0.0.1 when TUNNEL_PORT is set.
 */
import { execSync } from 'node:child_process';

const tunnelPort = process.env.TUNNEL_PORT?.trim();
const json = execSync(
  'railway variables --service provvypay-db --environment production --json',
  { encoding: 'utf8' }
);
const vars = JSON.parse(json);
const raw = vars.DATABASE_URL;
if (!raw) {
  process.stderr.write('DATABASE_URL missing on provvypay-db\n');
  process.exit(1);
}

const u = new URL(raw.replace(/^postgresql:/, 'postgres:'));
const host = u.hostname || '';
if (!host.includes('railway.internal') && !host.includes('rlwy.net')) {
  process.stderr.write(`Refusing non-Railway host: ${host}\n`);
  process.exit(1);
}
if (u.pathname.replace(/^\//, '') !== 'railway') {
  process.stderr.write(`Refusing unexpected database name: ${u.pathname}\n`);
  process.exit(1);
}

if (tunnelPort) {
  u.hostname = '127.0.0.1';
  u.port = tunnelPort;
}

process.stdout.write(u.toString().replace(/^postgres:/, 'postgresql:'));
