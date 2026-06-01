import fs from 'node:fs';
import path from 'node:path';

const OPERATIONS_ROOT = path.join(process.cwd(), 'lib', 'operations');

function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTsFiles(full));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

describe('commercial roles operational isolation', () => {
  it('does not read commercialRoles in operational graph code', () => {
    const files = collectTsFiles(OPERATIONS_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (
        text.includes('commercialRoles') ||
        text.includes('commercial-roles-payload') ||
        text.includes('project_allocations')
      ) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
