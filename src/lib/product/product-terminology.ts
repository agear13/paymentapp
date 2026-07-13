/**
 * Product terminology — user-facing labels only.
 *
 * Internal models, APIs, routes, and services keep their existing names.
 * Import from here for all operator-facing copy.
 */

export const PRODUCT_TERMINOLOGY = {
  project: 'Project',
  projects: 'Projects',
  projectLower: 'project',
  projectsLower: 'projects',

  /** In-app intelligence surface (not the public Agreement Analyzer product). */
  projectIntelligence: 'Project Intelligence',

  budgetedRole: 'Budgeted role',
  budgetedRoles: 'Budgeted Roles',
  budgetedRoleLower: 'budgeted role',
  budgetedRolesLower: 'budgeted roles',

  createProject: 'Create project',
  openProject: 'Open project',
  allProjects: 'All projects',
  totalProjects: 'Total projects',
  projectHealthOverview: 'Project health overview',
  yourProjects: 'Your projects',
  noProjectsYet: 'No projects yet.',
  projectNotFound: 'Project not found.',

  addBudgetedRole: 'Add budgeted role',
  noBudgetedRolesYet: 'No budgeted roles yet.',
  budgetedRoleCreated: 'Budgeted role created',
  budgetedRoleAdded: 'Budgeted role added',
  budgetedRoleRemoved: 'Budgeted role removed',
  couldNotRemoveBudgetedRole: 'Could not remove budgeted role',
  couldNotSaveBudgetedRole: 'Could not save budgeted role',

  budgetedRolesHelper:
    'Create your planned team roles and allocate their budgets before inviting participants.',
  budgetedRolesAssignHelper: "Later you'll assign real people to these budgeted roles.",

  projectCoordination: 'Project coordination',
  projectOverview: 'Project overview',
  projectHealth: 'Project health',
  acrossAllProjects: 'across all projects',
  acrossYourProjects: 'across your projects',
  forThisProject: 'for this project',

  /** Legal/commercial document — distinct from the workspace "project". */
  participationAgreement: 'participation agreement',

  planning: 'Planning',
  planningWorkspace: 'Planning workspace',
  commercialStory: 'Commercial Story',
  revenueSources: 'Revenue Sources',
  expectedObligations: 'Expected Obligations',
  forecastSurplus: 'Forecast Surplus',
  scenarioUnsavedChanges: 'Unsaved Changes',
  scenarioSimulationHint:
    'Forecast updates are being simulated only. Nothing has been changed in the live project.',
  discardScenario: 'Discard',
  saveScenario: 'Save Scenario',
  planningInsights: 'Planning Insights',
  scenarioSummary: 'Scenario Summary',
  riskSimulator: 'Risk Simulator',
  moneyOperationalHint:
    'This is the operational view of what is actually happening. Edit commercial assumptions in Planning.',

  commercialTiming: 'Commercial Timing',
  commercialTimingHelper:
    'When commercial activity occurs — independent from invoice issue and payment receipt dates.',
  servicePeriod: 'Service Period',
  recognitionPeriod: 'Recognition Period',
  expectedCustomerPayment: 'Expected Customer Payment',
  expectedParticipantSettlement: 'Expected Participant Settlement',
  commercialTimingSaved: 'Commercial timing saved',
} as const;

/** "1 project needs attention" / "3 projects need attention" */
export function projectsNeedAttentionLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? `1 ${PRODUCT_TERMINOLOGY.projectLower} needs attention`
    : `${count} ${PRODUCT_TERMINOLOGY.projectsLower} need attention`;
}

/** "1 project" / "3 projects" */
export function projectCountLabel(count: number): string {
  return `${count} ${count === 1 ? PRODUCT_TERMINOLOGY.projectLower : PRODUCT_TERMINOLOGY.projectsLower}`;
}

/** "1 project is" / "3 projects are" */
export function projectsProgressingLabel(count: number): string {
  return count === 1
    ? `1 ${PRODUCT_TERMINOLOGY.projectLower} is`
    : `${count} ${PRODUCT_TERMINOLOGY.projectsLower} are`;
}
