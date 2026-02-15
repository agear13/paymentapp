-- Make consultant_id nullable for "any consultant" BD-created links
ALTER TABLE "referral_rules" ALTER COLUMN "consultant_id" DROP NOT NULL;
