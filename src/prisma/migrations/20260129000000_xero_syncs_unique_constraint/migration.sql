-- ============================================
-- Xero Syncs: Add Unique Constraint on (payment_link_id, sync_type)
-- Ensures exactly ONE row per payment link per sync type (INVOICE/PAYMENT)
-- ============================================

-- Step 1: Identify and log duplicates (for audit trail)
-- This query shows which payment_link_ids have multiple syncs of the same type
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT payment_link_id, sync_type, COUNT(*) as cnt
    FROM xero_syncs
    GROUP BY payment_link_id, sync_type
    HAVING COUNT(*) > 1
  ) dups;
  
  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % payment_link_ids with duplicate xero_syncs records', dup_count;
  ELSE
    RAISE NOTICE 'No duplicates found - clean migration';
  END IF;
END $$;

-- Step 2: Clean up duplicates - keep the BEST row per (payment_link_id, sync_type)
-- Priority: SUCCESS > PENDING/RETRYING > FAILED
-- Within same status: keep newest (by created_at DESC)
WITH ranked_syncs AS (
  SELECT 
    id,
    payment_link_id,
    sync_type,
    status,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY payment_link_id, sync_type 
      ORDER BY 
        -- Priority order: SUCCESS first, then PENDING/RETRYING, then FAILED
        CASE status 
          WHEN 'SUCCESS' THEN 1 
          WHEN 'PENDING' THEN 2 
          WHEN 'RETRYING' THEN 2 
          WHEN 'FAILED' THEN 3 
        END,
        -- Within same status, keep newest
        created_at DESC
    ) as row_rank
  FROM xero_syncs
),
rows_to_delete AS (
  SELECT id FROM ranked_syncs WHERE row_rank > 1
)
DELETE FROM xero_syncs 
WHERE id IN (SELECT id FROM rows_to_delete);

-- Step 3: Log how many duplicates were cleaned up
DO $$
DECLARE
  deleted_count INT;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % duplicate xero_syncs records', deleted_count;
  END IF;
END $$;

-- Step 4: Add the unique constraint
-- This prevents future duplicates at the database level
ALTER TABLE xero_syncs 
ADD CONSTRAINT xero_syncs_payment_link_sync_type_unique 
UNIQUE (payment_link_id, sync_type);

-- Step 5: Verify constraint was added successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'xero_syncs_payment_link_sync_type_unique'
  ) THEN
    RAISE NOTICE '✅ Unique constraint successfully added';
  ELSE
    RAISE EXCEPTION '❌ Failed to add unique constraint';
  END IF;
END $$;

