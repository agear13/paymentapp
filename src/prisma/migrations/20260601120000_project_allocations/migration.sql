-- This migration directory previously had no migration.sql, which blocked
-- `prisma migrate deploy` (P3015). Current schema has no project_allocations table.
SELECT 1;
