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

  yourProjects: 'Your projects',
  projectCoordination: 'Project coordination',
  projectOverview: 'Project overview',
  projectHealth: 'Project health',
  acrossAllProjects: 'across all projects',
  acrossYourProjects: 'across your projects',
  forThisProject: 'for this project',

  /** Legal/commercial document — distinct from the workspace "project". */
  participationAgreement: 'participation agreement',
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
