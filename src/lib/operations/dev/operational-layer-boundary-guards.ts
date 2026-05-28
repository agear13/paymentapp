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
    forbidden: [/from ['"]@\/lib\/operations\/orchestration\//],
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
];

export function assertOperationalLayerBoundaries(sources: Record<string, string>): void {
  if (process.env.NODE_ENV === 'production') return;

  for (const [path, content] of Object.entries(sources)) {
    const normalized = path.replace(/\\/g, '/');
    for (const rule of FORBIDDEN_IMPORT_PATTERNS) {
      if (!rule.filePattern.test(normalized)) continue;
      for (const pattern of rule.forbidden) {
        if (pattern.test(content)) {
          throw new Error(
            `[operational-layer-boundary] ${rule.layer} layer violation in ${normalized}: forbidden import pattern ${pattern}`
          );
        }
      }
    }
  }
}
