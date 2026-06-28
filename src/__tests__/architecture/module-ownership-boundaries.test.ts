import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

type ImportRecord = {
  file: string;
  specifier: string;
  isTypeOnly: boolean;
};

function collectSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path.relative(ROOT, absolutePath)));
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(path.relative(ROOT, absolutePath).replaceAll(path.sep, '/'));
    }
  }
  return files;
}

function importsFor(file: string): ImportRecord[] {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const imports: ImportRecord[] = [];
  const importPattern = /import\s+(type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(importPattern)) {
    imports.push({
      file,
      specifier: match[2],
      isTypeOnly: Boolean(match[1]),
    });
  }
  return imports;
}

function collectImports(relativeDirs: string[]): ImportRecord[] {
  return relativeDirs.flatMap((dir) => collectSourceFiles(dir).flatMap(importsFor));
}

const CURRENT_AGREEMENTS_TO_RABBIT_HOLE_UI_BRIDGES = new Set([
  'app/(dashboard)/dashboard/projects/layout.tsx -> @/components/deal-network-demo/deal-network-experience-provider',
  'components/projects/projects-workspace-index.tsx -> @/components/deal-network-demo/create-deal-modal',
  'components/projects/projects-workspace-index.tsx -> @/components/deal-network-demo/deal-network-experience-provider',
]);

describe('module ownership boundaries', () => {
  it('keeps the frozen Rabbit Hole pilot from importing Agreements UI', () => {
    const imports = collectImports([
      'app/(dashboard)/dashboard/partners/deal-network',
      'components/deal-network-demo',
    ]);

    const offenders = imports
      .filter(
        ({ specifier }) =>
          specifier.startsWith('@/components/projects') ||
          specifier.startsWith('@/components/agreements')
      )
      .map(({ file, specifier }) => `${file} -> ${specifier}`);

    expect(offenders).toEqual([]);
  });

  it('prevents new Agreements imports from Rabbit Hole UI components', () => {
    const imports = collectImports([
      'app/(dashboard)/dashboard/projects',
      'components/projects',
      'components/agreements',
    ]);

    const offenders = imports
      .filter(
        ({ specifier, isTypeOnly }) =>
          !isTypeOnly && specifier.startsWith('@/components/deal-network-demo')
      )
      .map(({ file, specifier }) => `${file} -> ${specifier}`)
      .filter((entry) => !CURRENT_AGREEMENTS_TO_RABBIT_HOLE_UI_BRIDGES.has(entry));

    expect(offenders).toEqual([]);
  });
});
