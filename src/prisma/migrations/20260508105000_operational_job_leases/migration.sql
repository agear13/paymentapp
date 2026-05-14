CREATE TABLE IF NOT EXISTS "operational_job_leases" (
  "job_name" VARCHAR(128) NOT NULL,
  "owner_id" VARCHAR(191) NOT NULL,
  "lease_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "acquired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_job_leases_pkey" PRIMARY KEY ("job_name")
);

CREATE INDEX IF NOT EXISTS "operational_job_leases_lease_expires_at_idx"
  ON "operational_job_leases"("lease_expires_at");
