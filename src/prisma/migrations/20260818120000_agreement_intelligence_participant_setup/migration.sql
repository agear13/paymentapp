-- P3-D: participant setup phase between bootstrap and ACTIVE
ALTER TYPE "OrganizationWorkflowLifecycleStatus" ADD VALUE IF NOT EXISTS 'PARTICIPANT_SETUP';
