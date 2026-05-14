-- Idempotency marker for recurring template scheduler runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'RECURRING_EXECUTION'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentEventType')
  ) THEN
    ALTER TYPE "PaymentEventType" ADD VALUE 'RECURRING_EXECUTION';
  END IF;
END$$;
