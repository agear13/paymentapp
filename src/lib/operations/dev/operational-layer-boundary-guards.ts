/**
 * Dev-only architectural boundary checks for operational sync layering.
 * mutation → orchestration → selectors → verification → telemetry
 */

const FORBIDDEN_IMPORT_PATTERNS: Array<{
  layer: string;
  filePattern: RegExp;
  forbidden: RegExp[];
}> = [
  {
    layer: 'verification',
    filePattern: /(?:lib\/operations\/)?dev\/(assert-post-convergence-integrity|post-convergence-integrity-types)\.ts$/,
    forbidden: [
      /from ['"]@\/lib\/operations\/orchestration\/(operational-sync-convergence|operational-sync-client|fetch-post-convergence)/,
      /from ['"]@\/lib\/operations\/orchestration\/fetch-post-convergence-verification/,
    ],
  },
  {
    layer: 'telemetry',
    filePattern: /(?:lib\/operations\/)?telemetry\/operational-telemetry\.ts$/,
    forbidden: [
      /from ['"]@\/lib\/operations\/orchestration\//,
      /from ['"]@\/lib\/operations\/dev\//,
    ],
  },
  {
    layer: 'resilience',
    filePattern: /(?:lib\/operations\/)?orchestration\/operational-convergence-resilience\.ts$/,
    forbidden: [
      /from ['"]@\/lib\/operations\/orchestration\/operational-sync-convergence/,
      /from ['"]@\/lib\/operations\/orchestration\/operational-sync-client/,
      /from ['"]@\/lib\/operations\/orchestration\/fetch-post-convergence/,
      /from ['"]@\/lib\/operations\/sync\/fetch-coordination-snapshot-data/,
    ],
  },
  {
    layer: 'fetch-data',
    filePattern: /(?:lib\/operations\/)?sync\/fetch-coordination-snapshot-data\.ts$/,
    forbidden: [/from ['"]@\/lib\/operations\/orchestration\//],
  },
  {
    layer: 'orchestration-convergence',
    filePattern: /(?:lib\/operations\/)?orchestration\/operational-sync-convergence\.ts$/,
    forbidden: [/from ['"]@\/lib\/operations\/orchestration\/operational-sync-client/],
  },
  {
    layer: 'orchestration-client',
    filePattern: /(?:lib\/operations\/)?orchestration\/operational-sync-client\.ts$/,
    forbidden: [/from ['"]@\/lib\/operations\/dev\/post-convergence-verifier/],
  },
  {
    layer: 'truth',
    filePattern: /(?:lib\/operations\/)?truth\/[^/]+\.ts$/,
    forbidden: [/from ['"]@\/lib\/operations\/selectors\//],
  },
  {
    layer: 'derivations',
    filePattern: /(?:lib\/operations\/)?derivations\/[^/]+\.ts$/,
    forbidden: [/from ['"]@\/lib\/operations\/selectors\//],
  },
  {
    layer: 'hydration',
    filePattern: /(?:lib\/operations\/)?hydration\/[^/]+\.ts$/,
    forbidden: [
      /from ['"]@\/lib\/operations\/selectors\//,
      /from ['"]@\/lib\/operations\/dev\/operational-diagnostics/,
    ],
  },
  {
    layer: 'guards',
    filePattern: /(?:lib\/operations\/)?guards\/[^/]+\.ts$/,
    forbidden: [/from ['"]@\/lib\/operations\/selectors\//],
  },
  {
    layer: 'primitives',
    filePattern: /(?:lib\/operations\/)?primitives\/[^/]+\.ts$/,
    forbidden: [
      /from ['"]@\/lib\/operations\/selectors\//,
      /from ['"]@\/lib\/operations\/lifecycle\//,
      /from ['"]@\/lib\/operations\/dev\//,
    ],
  },
];

export function assertOperationalLayerBoundaries(sources: Record<string, string>): void {
  if (process.env.NODE_ENV === 'production') return;

  for (const [path, content] of Object.entries(sources)) {
    const normalized = path.replace(/\\/g, '/');
    for (const rule of FORBIDDEN_IMPORT_PATTERNS) {
      if (!rule.filePattern.test(normalized)) continue;
      for (const pattern of rule.forbidden) {
        if (pattern.test(content)) {
          const diagnosticsImport =
            rule.layer === 'telemetry' && /from ['"]@\/lib\/operations\/dev\//.test(content);
          const foundationImportsSelector =
            (rule.layer === 'truth' ||
              rule.layer === 'derivations' ||
              rule.layer === 'hydration' ||
              rule.layer === 'guards') &&
            /from ['"]@\/lib\/operations\/selectors\//.test(content);
          throw new Error(
            diagnosticsImport
              ? `[operational-layer-boundary] TELEMETRY_LAYER_IMPORTS_DIAGNOSTICS_LAYER in ${normalized}: forbidden import pattern ${pattern}`
              : foundationImportsSelector
                ? `[operational-layer-boundary] FOUNDATION_LAYER_IMPORTS_SELECTORS in ${normalized}: forbidden import pattern ${pattern}`
                : `[operational-layer-boundary] ${rule.layer} layer violation in ${normalized}: forbidden import pattern ${pattern}`
          );
        }
      }
    }
  }
}
