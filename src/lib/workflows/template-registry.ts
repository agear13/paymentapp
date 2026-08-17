import { getWorkflowBySlug, WORKFLOW_LIBRARY } from '@/lib/journey/workflow-library-catalog';
import type { WorkflowLibraryEntry } from '@/lib/journey/workflow-library-catalog';
import { sanitizeAgreementIntelligenceConfiguration } from '@/lib/workflows/agreement-intelligence/configuration';

export function resolveWorkflowTemplate(slug: string): WorkflowLibraryEntry | null {
  const entry = getWorkflowBySlug(slug);
  return entry ?? null;
}

export function isDeployableWorkflowSlug(slug: string): boolean {
  const entry = getWorkflowBySlug(slug);
  return entry?.template.deployable === true;
}

export function listCatalogSlugs(): string[] {
  return WORKFLOW_LIBRARY.map((entry) => entry.slug);
}

export function sanitizeWorkflowConfiguration(
  template: WorkflowLibraryEntry,
  input: unknown
): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Configuration must be a plain object');
  }

  const allowedKeys = Object.keys(template.template.configurationSchema ?? {});
  if (allowedKeys.length === 0) {
    const keys = Object.keys(input as Record<string, unknown>);
    if (keys.length > 0) {
      throw new Error('This workflow does not accept configuration');
    }
    return {};
  }

  if (template.slug === 'agreement-intelligence') {
    return sanitizeAgreementIntelligenceConfiguration(input);
  }

  const raw = input as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in raw) {
      sanitized[key] = raw[key];
    }
  }
  return sanitized;
}
