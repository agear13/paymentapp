-- READ-ONLY diagnostic for /auth/callback database dependencies.
-- Safe to run on production. Does not modify anything.
--
-- Railway option A (recommended): use the Node script via Railway CLI:
--   railway link && railway run npm run verify:auth-callback-schema
--
-- Railway option B (psql with injected DATABASE_URL, same service context):
--   railway run psql "$DATABASE_URL" -f scripts/verify-auth-callback-schema.sql
--
-- Do NOT paste connection strings into chat. Run only via Railway CLI/service shell.

\echo '=== AUTH CALLBACK SCHEMA DIAGNOSTIC (READ-ONLY SQL) ==='
\echo ''

SELECT
  current_database() AS database,
  current_user AS db_user,
  split_part(version(), ' ', 1) || ' ' || split_part(version(), ' ', 2) AS postgres_version;

\echo ''
\echo '--- TABLES ---'

SELECT
  t.table_name,
  CASE WHEN pt.tablename IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('user_auth_profiles'),
    ('deal_network_pilot_participants')
) AS t(table_name)
LEFT JOIN pg_tables pt
  ON pt.schemaname = 'public'
 AND pt.tablename = t.table_name
ORDER BY t.table_name;

\echo ''
\echo '--- COLUMNS (deal_network_pilot_participants) ---'

SELECT
  c.column_name,
  CASE WHEN ic.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('authenticated_user_id'),
    ('source_organization_id'),
    ('converted_organization_id'),
    ('converted_at')
) AS c(column_name)
LEFT JOIN information_schema.columns ic
  ON ic.table_schema = 'public'
 AND ic.table_name = 'deal_network_pilot_participants'
 AND ic.column_name = c.column_name
ORDER BY c.column_name;

\echo ''
\echo '--- MIGRATIONS (_prisma_migrations) ---'

SELECT
  m.migration_name,
  CASE WHEN pm.migration_name IS NOT NULL THEN 'APPLIED' ELSE 'NOT_RECORDED' END AS status,
  pm.finished_at
FROM (
  VALUES
    ('20260624120000_user_auth_profiles'),
    ('20260821090000_participant_authenticated_user_id'),
    ('20260823200000_participant_workspace_attribution')
) AS m(migration_name)
LEFT JOIN _prisma_migrations pm
  ON pm.migration_name = m.migration_name
ORDER BY m.migration_name;

\echo ''
\echo '--- MISMATCH HINTS (read-only) ---'

WITH expected AS (
  SELECT unnest(ARRAY[
    'user_auth_profiles',
    'deal_network_pilot_participants'
  ]) AS table_name
),
participant_cols AS (
  SELECT unnest(ARRAY[
    'authenticated_user_id',
    'source_organization_id',
    'converted_organization_id',
    'converted_at'
  ]) AS column_name
),
migration_names AS (
  SELECT unnest(ARRAY[
    '20260624120000_user_auth_profiles',
    '20260821090000_participant_authenticated_user_id',
    '20260823200000_participant_workspace_attribution'
  ]) AS migration_name
)
SELECT issue FROM (
  SELECT 'MISSING TABLE: ' || e.table_name AS issue
  FROM expected e
  LEFT JOIN pg_tables pt
    ON pt.schemaname = 'public' AND pt.tablename = e.table_name
  WHERE pt.tablename IS NULL

  UNION ALL

  SELECT 'MISSING COLUMN: deal_network_pilot_participants.' || pc.column_name
  FROM participant_cols pc
  LEFT JOIN information_schema.columns ic
    ON ic.table_schema = 'public'
   AND ic.table_name = 'deal_network_pilot_participants'
   AND ic.column_name = pc.column_name
  WHERE ic.column_name IS NULL

  UNION ALL

  SELECT 'MIGRATION NOT RECORDED: ' || mn.migration_name
  FROM migration_names mn
  LEFT JOIN _prisma_migrations pm ON pm.migration_name = mn.migration_name
  WHERE pm.migration_name IS NULL
) issues
ORDER BY issue;
