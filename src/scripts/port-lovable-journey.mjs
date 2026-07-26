#!/usr/bin/env node
/**
 * Port Lovable TanStack routes → Next.js journey components.
 * Run: node src/scripts/port-lovable-journey.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const lovableRoutes = path.join(repoRoot, 'src/lovable-import/src/routes');
const outDir = path.join(repoRoot, 'src/components/journey/lovable');

const FILES = [
  {
    source: 'index.tsx',
    out: 'journey-landing-page.tsx',
    exportName: 'JourneyLandingPage',
    componentName: 'JourneyLandingPage',
  },
  {
    source: 'assessment.tsx',
    out: 'assessment-layout.tsx',
    exportName: 'AssessmentLayout',
    componentName: 'AssessmentLayout',
    stripOutlet: true,
  },
  {
    source: 'assessment.index.tsx',
    out: 'assessment-objective-screen.tsx',
    exportName: 'AssessmentObjectiveScreen',
    componentName: 'AssessmentObjectiveScreen',
  },
  {
    source: 'assessment.business.tsx',
    out: 'assessment-business-screen.tsx',
    exportName: 'AssessmentBusinessScreen',
    componentName: 'AssessmentBusinessScreen',
  },
  {
    source: 'assessment.connect.tsx',
    out: 'assessment-connect-screen.tsx',
    exportName: 'AssessmentConnectScreen',
    componentName: 'AssessmentConnectScreen',
  },
  {
    source: 'assessment.analysis.tsx',
    out: 'assessment-analysis-screen.tsx',
    exportName: 'AssessmentAnalysisScreen',
    componentName: 'AssessmentAnalysisScreen',
  },
  {
    source: 'assessment.recommendation.tsx',
    out: 'workflow-recommendation-screen.tsx',
    exportName: 'WorkflowRecommendationScreen',
    componentName: 'WorkflowRecommendationScreen',
  },
  {
    source: 'assessment.create-workspace.tsx',
    out: 'workspace-create-screen.tsx',
    exportName: 'WorkspaceCreateScreen',
    componentName: 'WorkspaceCreateScreen',
  },
  {
    source: 'assessment.provisioning.tsx',
    out: 'workspace-provisioning-screen.tsx',
    exportName: 'WorkspaceProvisioningScreen',
    componentName: 'WorkspaceProvisioningScreen',
  },
  {
    source: 'workspace.tsx',
    out: 'workspace-layout.tsx',
    exportName: 'WorkspaceLayout',
    componentName: 'WorkspaceLayout',
    stripOutlet: true,
  },
  {
    source: 'workspace.index.tsx',
    out: 'workspace-home-screen.tsx',
    exportName: 'WorkspaceHomeScreen',
    componentName: 'WorkspaceHomeScreen',
  },
  {
    source: 'workspace.workflow.reconciliation.tsx',
    out: 'workflow-reconciliation-screen.tsx',
    exportName: 'WorkflowReconciliationScreen',
    componentName: 'WorkflowReconciliationScreen',
  },
];

const ROUTE_MAP = [
  ['navigate({ to: "/assessment/provisioning" }', 'router.push("/journey/provisioning/build")'],
  ['navigate({ to: "/assessment/create-workspace" }', 'router.push("/journey/provisioning")'],
  ['navigate({ to: "/assessment/recommendation" }', 'router.push("/journey/recommendation")'],
  ['navigate({ to: "/assessment/analysis" }', 'router.push("/journey/assessment/analysis")'],
  ['navigate({ to: "/assessment/connect" }', 'router.push("/journey/assessment/connect")'],
  ['navigate({ to: "/assessment/business" }', 'router.push("/journey/assessment/business")'],
  ['navigate({ to: "/assessment" }', 'router.push("/journey/assessment")'],
  ['to="/assessment/provisioning"', 'href="/journey/provisioning/build"'],
  ['to="/assessment/create-workspace"', 'href="/journey/provisioning"'],
  ['to="/assessment/recommendation"', 'href="/journey/recommendation"'],
  ['to="/assessment/analysis"', 'href="/journey/assessment/analysis"'],
  ['to="/assessment/connect"', 'href="/journey/assessment/connect"'],
  ['to="/assessment/business"', 'href="/journey/assessment/business"'],
  ['to="/assessment"', 'href="/journey/assessment"'],
  ['to="/workspace/workflow/reconciliation"', 'href="/workspace/workflow/reconciliation"'],
  ['to="/workspace/workflows"', 'href="/workspace/workflows"'],
  ['to="/workspace/timeline"', 'href="/workspace/timeline"'],
  ['to="/workspace/connected"', 'href="/workspace/connected"'],
  ['to="/workspace/advisor"', 'href="/workspace/advisor"'],
  ['to="/workspace/settings"', 'href="/workspace/settings"'],
  ['to="/workspace"', 'href="/workspace"'],
  ['to="/"', 'href="/journey"'],
  ['href="/assessment"', 'href="/journey/assessment"'],
  ['href="/login"', 'href="/auth/login"'],
];

function transform(raw, { exportName, componentName, stripOutlet, out }) {
  let s = raw;

  s = s.replace(/^import provvyLogo from "@\/assets\/provvy-logo\.png\.asset\.json";\n/m, '');
  s = s.replace(/<img src={provvyLogo\.url} alt="Provvy" className="([^"]+)" \/>/g, '<ProvvyBrandMark href="/journey" />');
  s = s.replace(
    /<Link to="\/" className="flex items-center gap-2">\s*<ProvvyBrandMark href="\/journey" \/>\s*<span[^>]*>Provvy<\/span>\s*<\/Link>/g,
    '<ProvvyBrandMark href="/journey" />',
  );

  s = s.replace(/import \{ createFileRoute[^}]+\} from "@tanstack\/react-router";\n/g, '');
  s = s.replace(/export const Route = createFileRoute\([^)]+\)\(\{[\s\S]*?\}\);\n/g, '');

  s = s.replace(
    /import \{ createFileRoute, Link, Outlet, useRouterState \} from "@tanstack\/react-router";/,
    "import Link from 'next/link';\nimport { usePathname } from 'next/navigation';",
  );
  s = s.replace(
    /import \{ createFileRoute, Link, useNavigate \} from "@tanstack\/react-router";/g,
    "import Link from 'next/link';\nimport { useRouter } from 'next/navigation';",
  );
  s = s.replace(
    /import \{ createFileRoute, useNavigate, Link \} from "@tanstack\/react-router";/g,
    "import Link from 'next/link';\nimport { useRouter } from 'next/navigation';",
  );
  s = s.replace(
    /import \{ createFileRoute, useNavigate \} from "@tanstack\/react-router";/g,
    "import { useRouter } from 'next/navigation';",
  );
  s = s.replace(/import \{ createFileRoute, Link \} from "@tanstack\/react-router";/g, "import Link from 'next/link';");
  s = s.replace(/import \{ Link, createFileRoute \} from "@tanstack\/react-router";/g, "import Link from 'next/link';");

  for (const [from, to] of ROUTE_MAP) {
    s = s.split(from).join(to);
  }

  s = s.replace(/\buseNavigate\(\)/g, 'useRouter()');
  s = s.replace(/\buseRouterState\(\{ select: \(s\) => s\.location\.pathname \}\)/g, 'usePathname()');
  s = s.replace(/\bconst pathname = usePathname\(\);/g, 'const pathname = usePathname() ?? "";');

  s = s.replace(/<Link to=/g, '<Link href=');
  s = s.replace(/function Home\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function AssessmentLayout\(\)/g, `export function ${exportName}({ children }: { children: React.ReactNode })`);
  s = s.replace(/function ObjectiveScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function BusinessScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function ConnectScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function AnalysisScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function RecommendationScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function CreateWorkspaceScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function ProvisioningScreen\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function WorkspaceLayout\(\)/g, `export function ${exportName}({ children }: { children: React.ReactNode })`);
  s = s.replace(/function WorkspaceHome\(\)/g, `export function ${exportName}()`);
  s = s.replace(/function WorkflowRoom\(\)/g, `export function ${exportName}()`);

  if (stripOutlet) {
    s = s.replace(/<Outlet \/>/g, '{children}');
    s = s.replace(/<main className="relative">\s*\{children\}\s*<\/main>/g, '<main className="relative">{children}</main>');
  }

  const needsRouter = s.includes('useRouter()');
  const needsPathname = s.includes('usePathname()');
  const needsLink = s.includes('<Link ') || s.includes('Link href');
  const needsBrand = s.includes('ProvvyBrandMark');

  const imports = ["'use client';", ''];
  if (needsLink && !s.includes("from 'next/link'")) imports.push("import Link from 'next/link';");
  if (needsRouter && !s.includes("from 'next/navigation'")) imports.push("import { useRouter } from 'next/navigation';");
  if (needsPathname && !s.includes('usePathname')) imports.push("import { usePathname } from 'next/navigation';");
  if (needsBrand) imports.push("import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';");

  s = s.replace(/^'use client';\s*/m, '');
  s = s.replace(/^import Link from 'next\/link';\s*/m, '');
  s = s.replace(/^import \{ useRouter \} from 'next\/navigation';\s*/m, '');
  s = s.replace(/^import \{ usePathname \} from 'next\/navigation';\s*/m, '');
  s = s.replace(/^import \{ ProvvyBrandMark \}[^;]+;\s*/m, '');

  if (out === 'workspace-layout.tsx' || out === 'workspace-home-screen.tsx' || out === 'workflow-reconciliation-screen.tsx') {
    if (!s.includes("lovable-journey.css")) {
      s = s.replace(/^('use client';\n)/, "$1import '@/components/journey/lovable/lovable-journey.css';\n");
    }
  }

  if (out === 'workspace-layout.tsx') {
    s = s.replace(
      '<div className="min-h-screen bg-background text-foreground antialiased">',
      '<div className="lovable-journey min-h-screen bg-background text-foreground antialiased">',
    );
    s = s.replace(
      /<Link href="\/workspace" className="flex items-center gap-2">\s*<ProvvyBrandMark href="\/journey" \/>\s*<span[^>]*>Provvy<\/span>\s*<\/Link>/g,
      '<ProvvyBrandMark href="/workspace" />',
    );
  }

  s = `${imports.join('\n')}\n${s.trim()}\n`;

  if (!s.includes(`export function ${exportName}`)) {
    s = s.replace(
      new RegExp(`function ${componentName}\\(`),
      `export function ${exportName}(`,
    );
  }

  return s;
}

fs.mkdirSync(outDir, { recursive: true });

for (const file of FILES) {
  const sourcePath = path.join(lovableRoutes, file.source);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing: ${sourcePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const transformed = transform(raw, file);
  const outPath = path.join(outDir, file.out);
  fs.writeFileSync(outPath, transformed, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
}

console.log('Done.');
