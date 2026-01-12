-- Migration: Add user_organizations junction table for proper multi-tenancy
-- This fixes the data isolation bug where all users see all organizations' data

-- Create user_organizations junction table
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,  -- Supabase auth.users.id
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',  -- OWNER, ADMIN, MEMBER
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure a user can only be added to an organization once
  UNIQUE(user_id, organization_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS user_organizations_user_id_idx ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS user_organizations_organization_id_idx ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS user_organizations_role_idx ON user_organizations(role);

-- Add comments for documentation
COMMENT ON TABLE user_organizations IS 'Junction table linking users to organizations with roles';
COMMENT ON COLUMN user_organizations.user_id IS 'Supabase auth.users.id (UUID as string)';
COMMENT ON COLUMN user_organizations.organization_id IS 'Reference to organizations table';
COMMENT ON COLUMN user_organizations.role IS 'User role within the organization: OWNER, ADMIN, MEMBER';

