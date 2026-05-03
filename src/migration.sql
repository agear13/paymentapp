-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'DUPLICATE', 'IGNORED', 'ERROR');

-- CreateEnum
CREATE TYPE "FxSnapshotType" AS ENUM ('CREATION', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('CREATED', 'OPENED', 'PAYMENT_INITIATED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELED', 'REFUND_CONFIRMED', 'CRYPTO_PAYMENT_SUBMITTED');

-- CreateEnum
CREATE TYPE "PaymentEventSourceType" AS ENUM ('PAYMENT_LINK', 'STRIPE', 'CRYPTO', 'WISE', 'MANUAL', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "PaymentEventRecordStatus" AS ENUM ('RECORDED', 'PENDING_REVIEW', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID_UNVERIFIED', 'REQUIRES_REVIEW', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'HEDERA', 'WISE', 'CRYPTO', 'MANUAL_BANK');

-- CreateEnum
CREATE TYPE "CryptoPaymentConfirmationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CryptoVerificationStatus" AS ENUM ('VERIFIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PaymentToken" AS ENUM ('HBAR', 'USDC', 'USDT', 'AUDD');

-- CreateEnum
CREATE TYPE "XeroSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "XeroSyncType" AS ENUM ('INVOICE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'XERO_SYNC_FAILED', 'RECONCILIATION_ISSUE', 'SECURITY_ALERT', 'WEEKLY_SUMMARY', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReferralLinkStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('GROSS', 'NET');

-- CreateEnum
CREATE TYPE "CommissionObligationStatus" AS ENUM ('CREATED', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('PAYPAL', 'WISE', 'BANK_TRANSFER', 'CRYPTO', 'MANUAL_NOTE', 'HEDERA');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CommissionObligationLineStatus" AS ENUM ('POSTED', 'PAID');

-- CreateEnum
CREATE TYPE "CommissionObligationItemStatus" AS ENUM ('POSTED', 'PENDING_BENEFICIARY', 'PAID');

-- CreateEnum
CREATE TYPE "DealNetworkPilotObligationStatus" AS ENUM ('DRAFT', 'UNFUNDED', 'PARTIALLY_FUNDED', 'PENDING_APPROVAL', 'APPROVED', 'AVAILABLE_FOR_PAYOUT', 'PAID', 'REJECTED', 'REVERSED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" VARCHAR(255),
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "api_version" VARCHAR(32),
    "request_id" VARCHAR(255),
    "signature_present" BOOLEAN NOT NULL DEFAULT false,
    "signature_header" VARCHAR(512),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "raw_body" TEXT NOT NULL,
    "headers" JSONB,
    "parsed_event" JSONB,
    "correlation_id" VARCHAR(255),
    "organization_id" UUID,
    "payment_link_id" UUID,
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_charge_id" VARCHAR(255),
    "stripe_refund_id" VARCHAR(255),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_snapshots" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "snapshot_type" "FxSnapshotType" NOT NULL,
    "token_type" "PaymentToken",
    "base_currency" VARCHAR(10) NOT NULL,
    "quote_currency" VARCHAR(10) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "account_type" "LedgerAccountType" NOT NULL,
    "xero_account_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "default_currency" CHAR(3) NOT NULL,
    "stripe_account_id" VARCHAR(255),
    "hedera_account_id" VARCHAR(50),
    "organization_logo_url" VARCHAR(1024),
    "xero_revenue_account_id" VARCHAR(255),
    "xero_receivable_account_id" VARCHAR(255),
    "xero_stripe_clearing_account_id" VARCHAR(255),
    "xero_hbar_clearing_account_id" VARCHAR(255),
    "xero_usdc_clearing_account_id" VARCHAR(255),
    "xero_usdt_clearing_account_id" VARCHAR(255),
    "xero_audd_clearing_account_id" VARCHAR(255),
    "xero_wise_clearing_account_id" VARCHAR(255),
    "xero_fee_expense_account_id" VARCHAR(255),
    "wise_profile_id" VARCHAR(255),
    "wise_enabled" BOOLEAN NOT NULL DEFAULT false,
    "wise_currency" CHAR(3),
    "enabled_currencies" TEXT[] DEFAULT ARRAY['USD', 'AUD']::TEXT[],
    "show_symbols_in_ui" BOOLEAN NOT NULL DEFAULT true,
    "show_codes_in_ui" BOOLEAN NOT NULL DEFAULT false,
    "auto_refresh_rates" BOOLEAN NOT NULL DEFAULT true,
    "rate_refresh_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "merchant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "clerk_org_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID,
    "organization_id" UUID,
    "pilot_deal_id" VARCHAR(255),
    "event_type" "PaymentEventType" NOT NULL,
    "payment_method" "PaymentMethod",
    "source_type" "PaymentEventSourceType",
    "source_reference" VARCHAR(512),
    "gross_amount" DECIMAL(18,8),
    "net_amount" DECIMAL(18,8),
    "currency_received" VARCHAR(10),
    "received_at" TIMESTAMPTZ(6),
    "record_status" "PaymentEventRecordStatus",
    "raw_payload_json" JSONB,
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_event_id" VARCHAR(255),
    "hedera_transaction_id" VARCHAR(255),
    "wise_transfer_id" VARCHAR(255),
    "amount_received" DECIMAL(18,8),
    "correlation_id" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "short_code" VARCHAR(8) NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_method" "PaymentMethod",
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "invoice_currency" CHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "invoice_reference" VARCHAR(255),
    "customer_email" VARCHAR(255),
    "customer_phone" VARCHAR(50),
    "customer_name" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6),
    "invoice_date" TIMESTAMPTZ(6),
    "due_date" TIMESTAMPTZ(6),
    "xero_invoice_number" VARCHAR(255),
    "customer_selected_currency" CHAR(3),
    "conversion_rate_at_creation" DECIMAL(18,8),
    "base_amount" DECIMAL(18,2),
    "base_currency" CHAR(3),
    "wise_quote_id" VARCHAR(255),
    "wise_transfer_id" VARCHAR(255),
    "wise_status" VARCHAR(50),
    "wise_received_amount" DECIMAL(18,8),
    "wise_received_currency" CHAR(3),
    "invoice_only_mode" BOOLEAN NOT NULL DEFAULT false,
    "hedera_checkout_mode" VARCHAR(32),
    "crypto_network" VARCHAR(255),
    "crypto_address" VARCHAR(512),
    "crypto_currency" VARCHAR(64),
    "crypto_memo" VARCHAR(512),
    "crypto_instructions" TEXT,
    "manual_bank_recipient_name" VARCHAR(255),
    "manual_bank_currency" VARCHAR(16),
    "manual_bank_destination_type" VARCHAR(64),
    "manual_bank_bank_name" VARCHAR(255),
    "manual_bank_account_number" VARCHAR(128),
    "manual_bank_iban" VARCHAR(128),
    "manual_bank_swift_bic" VARCHAR(64),
    "manual_bank_routing_sort_code" VARCHAR(64),
    "manual_bank_wise_reference" VARCHAR(255),
    "manual_bank_revolut_handle" VARCHAR(255),
    "manual_bank_instructions" TEXT,
    "attachment_storage_key" VARCHAR(1024),
    "attachment_bucket" VARCHAR(128) DEFAULT 'payment-link-attachments',
    "attachment_filename" VARCHAR(512),
    "attachment_mime_type" VARCHAR(128),
    "attachment_size_bytes" INTEGER,
    "last_sent_at" TIMESTAMPTZ(6),
    "last_sent_to_email" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "pilot_deal_id" VARCHAR(255),

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_payment_confirmations" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "status" "CryptoPaymentConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "payer_network" VARCHAR(255) NOT NULL,
    "payer_amount_sent" VARCHAR(64) NOT NULL,
    "payer_wallet_address" VARCHAR(512) NOT NULL,
    "payer_currency" VARCHAR(64),
    "payer_tx_hash" VARCHAR(255),
    "verification_status" "CryptoVerificationStatus",
    "match_confidence" "MatchConfidence",
    "verification_issues" JSONB NOT NULL DEFAULT '[]',
    "merchant_acknowledged_at" TIMESTAMPTZ(6),
    "merchant_investigation_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "crypto_payment_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_bank_payment_confirmations" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "status" "CryptoPaymentConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "payer_amount_sent" VARCHAR(64) NOT NULL,
    "payer_currency" VARCHAR(16),
    "payer_destination" VARCHAR(255),
    "payer_payment_method_used" VARCHAR(128),
    "payer_reference" VARCHAR(255),
    "payer_proof_details" TEXT,
    "payer_note" TEXT,
    "verification_status" "CryptoVerificationStatus",
    "match_confidence" "MatchConfidence",
    "verification_issues" JSONB NOT NULL DEFAULT '[]',
    "merchant_acknowledged_at" TIMESTAMPTZ(6),
    "merchant_investigation_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "manual_bank_payment_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_syncs" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "sync_type" "XeroSyncType" NOT NULL,
    "status" "XeroSyncStatus" NOT NULL,
    "xero_invoice_id" VARCHAR(255),
    "xero_payment_id" VARCHAR(255),
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "xero_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_email" VARCHAR(255),
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "notification_id" UUID,
    "to_email" VARCHAR(255) NOT NULL,
    "from_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "template_name" VARCHAR(100) NOT NULL,
    "template_data" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "provider_id" VARCHAR(255),
    "provider_response" JSONB,
    "error_message" TEXT,
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "bounced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    "payment_confirmed_email" BOOLEAN NOT NULL DEFAULT true,
    "payment_failed_email" BOOLEAN NOT NULL DEFAULT true,
    "xero_sync_failed_email" BOOLEAN NOT NULL DEFAULT true,
    "reconciliation_issue_email" BOOLEAN NOT NULL DEFAULT true,
    "weekly_summary_email" BOOLEAN NOT NULL DEFAULT true,
    "security_alert_email" BOOLEAN NOT NULL DEFAULT true,
    "payment_confirmed_inapp" BOOLEAN NOT NULL DEFAULT true,
    "payment_failed_inapp" BOOLEAN NOT NULL DEFAULT true,
    "xero_sync_failed_inapp" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_configs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "display_priority" INTEGER NOT NULL DEFAULT 0,
    "custom_symbol" VARCHAR(10),
    "custom_decimal_places" INTEGER,
    "xero_clearing_account_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "currency_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rate_history" (
    "id" UUID NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "fx_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rate_overrides" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "override_rate" DECIMAL(18,8) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_until" TIMESTAMPTZ(6),
    "reason" TEXT,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rate_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_display_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "display_format" VARCHAR(50) NOT NULL DEFAULT 'symbol_amount_code',
    "thousand_separator" VARCHAR(5) NOT NULL DEFAULT ',',
    "decimal_separator" VARCHAR(5) NOT NULL DEFAULT '.',
    "symbol_position" VARCHAR(10) NOT NULL DEFAULT 'before',
    "space_after_symbol" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "currency_display_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multi_currency_invoices" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "invoice_currency" CHAR(3) NOT NULL,
    "line_items" JSONB NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "conversion_rates" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "multi_currency_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_user_id" VARCHAR(255),
    "code" VARCHAR(50) NOT NULL,
    "status" "ReferralLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "checkout_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referral_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_link_splits" (
    "id" UUID NOT NULL,
    "referral_link_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" DECIMAL(10,4) NOT NULL,
    "beneficiary_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_link_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rules" (
    "id" UUID NOT NULL,
    "referral_link_id" UUID NOT NULL,
    "consultant_id" UUID,
    "bd_partner_id" UUID,
    "consultant_pct" DECIMAL(5,4) NOT NULL,
    "bd_partner_pct" DECIMAL(5,4) NOT NULL,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'GROSS',
    "min_cap" DECIMAL(18,2),
    "max_cap" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_obligations" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "referral_link_id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "consultant_amount" DECIMAL(18,8) NOT NULL,
    "bd_partner_amount" DECIMAL(18,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionObligationStatus" NOT NULL DEFAULT 'CREATED',
    "correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_obligation_items" (
    "id" UUID NOT NULL,
    "commission_obligation_id" UUID NOT NULL,
    "split_id" UUID NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionObligationItemStatus" NOT NULL DEFAULT 'POSTED',
    "payout_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_obligation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_obligation_lines" (
    "id" UUID NOT NULL,
    "obligation_id" UUID NOT NULL,
    "payee_user_id" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionObligationLineStatus" NOT NULL DEFAULT 'POSTED',
    "payout_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_obligation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_methods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "method_type" "PayoutMethodType" NOT NULL,
    "handle" VARCHAR(255),
    "notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "hedera_account_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "payout_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "payout_method_id" UUID,
    "currency" CHAR(3) NOT NULL,
    "gross_amount" DECIMAL(18,8) NOT NULL,
    "fee_amount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,8) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "external_reference" VARCHAR(255),
    "paid_at" TIMESTAMPTZ(6),
    "failed_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_network_pilot_deals" (
    "id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "contact" TEXT,
    "deal_value" DECIMAL(18,2) NOT NULL,
    "payment_link" TEXT,
    "payment_status" VARCHAR(32) NOT NULL,
    "paid_amount" DECIMAL(18,2),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deal_payload" JSONB NOT NULL,

    CONSTRAINT "deal_network_pilot_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_network_pilot_obligations" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "organization_id" UUID,
    "deal_id" VARCHAR(255) NOT NULL,
    "participant_id" VARCHAR(255),
    "allocation_rule_id" UUID,
    "payment_event_id" UUID,
    "obligation_type" VARCHAR(64) NOT NULL,
    "amount_owed" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" "DealNetworkPilotObligationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculation_explanation" TEXT NOT NULL,
    "calculation_snapshot_json" JSONB NOT NULL,
    "due_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deal_network_pilot_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_network_pilot_participants" (
    "id" VARCHAR(255) NOT NULL,
    "deal_id" VARCHAR(255) NOT NULL,
    "invite_token" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(512),
    "role" VARCHAR(64) NOT NULL,
    "role_details" TEXT,
    "payout_condition" TEXT,
    "approval_status" VARCHAR(64) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "participant_payload" JSONB NOT NULL,

    CONSTRAINT "deal_network_pilot_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_status_received_at_idx" ON "webhook_events"("provider", "status", "received_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_payment_link_id_received_at_idx" ON "webhook_events"("payment_link_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_organization_id_received_at_idx" ON "webhook_events"("organization_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_stripe_payment_intent_id_idx" ON "webhook_events"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "webhook_events_stripe_refund_id_idx" ON "webhook_events"("stripe_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "fx_snapshots_payment_link_id_snapshot_type_base_currency_qu_key" ON "fx_snapshots"("payment_link_id", "snapshot_type", "base_currency", "quote_currency");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_organization_id_code_key" ON "ledger_accounts"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotency_key_key" ON "ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "merchant_settings_organization_id_idx" ON "merchant_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_clerk_org_id_key" ON "organizations"("clerk_org_id");

-- CreateIndex
CREATE INDEX "user_organizations_user_id_idx" ON "user_organizations"("user_id");

-- CreateIndex
CREATE INDEX "user_organizations_organization_id_idx" ON "user_organizations"("organization_id");

-- CreateIndex
CREATE INDEX "user_organizations_role_idx" ON "user_organizations"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_user_id_organization_id_key" ON "user_organizations"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "payment_events_payment_link_correlation_idx" ON "payment_events"("payment_link_id", "correlation_id");

-- CreateIndex
CREATE INDEX "payment_events_payment_link_id_created_at_idx" ON "payment_events"("payment_link_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_events_stripe_event_id_idx" ON "payment_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "payment_events_wise_transfer_id_idx" ON "payment_events"("wise_transfer_id");

-- CreateIndex
CREATE INDEX "payment_events_pilot_deal_id_idx" ON "payment_events"("pilot_deal_id");

-- CreateIndex
CREATE INDEX "payment_events_organization_id_idx" ON "payment_events"("organization_id");

-- CreateIndex
CREATE INDEX "payment_events_source_type_idx" ON "payment_events"("source_type");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_short_code_key" ON "payment_links"("short_code");

-- CreateIndex
CREATE INDEX "payment_links_organization_id_status_idx" ON "payment_links"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_links_due_date_idx" ON "payment_links"("due_date");

-- CreateIndex
CREATE INDEX "payment_links_expires_at_idx" ON "payment_links"("expires_at");

-- CreateIndex
CREATE INDEX "payment_links_payment_method_idx" ON "payment_links"("payment_method");

-- CreateIndex
CREATE INDEX "payment_links_pilot_deal_id_idx" ON "payment_links"("pilot_deal_id");

-- CreateIndex
CREATE INDEX "crypto_payment_confirmations_payment_link_id_status_idx" ON "crypto_payment_confirmations"("payment_link_id", "status");

-- CreateIndex
CREATE INDEX "crypto_payment_confirmations_status_created_at_idx" ON "crypto_payment_confirmations"("status", "created_at");

-- CreateIndex
CREATE INDEX "manual_bank_payment_confirmations_payment_link_id_status_idx" ON "manual_bank_payment_confirmations"("payment_link_id", "status");

-- CreateIndex
CREATE INDEX "manual_bank_payment_confirmations_status_created_at_idx" ON "manual_bank_payment_confirmations"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "xero_connections_organization_id_key" ON "xero_connections"("organization_id");

-- CreateIndex
CREATE INDEX "xero_syncs_status_next_retry_at_idx" ON "xero_syncs"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "xero_syncs_payment_link_id_sync_type_key" ON "xero_syncs"("payment_link_id", "sync_type");

-- CreateIndex
CREATE INDEX "notifications_organization_id_created_at_idx" ON "notifications"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_email_created_at_idx" ON "notifications"("user_email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "email_logs_status_created_at_idx" ON "email_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_logs_to_email_idx" ON "email_logs"("to_email");

-- CreateIndex
CREATE INDEX "email_logs_notification_id_idx" ON "email_logs"("notification_id");

-- CreateIndex
CREATE INDEX "notification_preferences_organization_id_user_email_idx" ON "notification_preferences"("organization_id", "user_email");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_organization_id_user_email_key" ON "notification_preferences"("organization_id", "user_email");

-- CreateIndex
CREATE INDEX "currency_configs_organization_id_is_enabled_idx" ON "currency_configs"("organization_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "currency_configs_organization_id_currency_code_key" ON "currency_configs"("organization_id", "currency_code");

-- CreateIndex
CREATE INDEX "fx_rate_history_base_currency_quote_currency_recorded_at_idx" ON "fx_rate_history"("base_currency", "quote_currency", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "fx_rate_history_recorded_at_idx" ON "fx_rate_history"("recorded_at" DESC);

-- CreateIndex
CREATE INDEX "fx_rate_overrides_organization_id_idx" ON "fx_rate_overrides"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rate_overrides_organization_id_base_currency_quote_curre_key" ON "fx_rate_overrides"("organization_id", "base_currency", "quote_currency", "effective_from");

-- CreateIndex
CREATE INDEX "currency_display_preferences_organization_id_idx" ON "currency_display_preferences"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "currency_display_preferences_organization_id_currency_code_key" ON "currency_display_preferences"("organization_id", "currency_code");

-- CreateIndex
CREATE INDEX "multi_currency_invoices_payment_link_id_idx" ON "multi_currency_invoices"("payment_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_links_code_key" ON "referral_links"("code");

-- CreateIndex
CREATE INDEX "referral_links_organization_id_idx" ON "referral_links"("organization_id");

-- CreateIndex
CREATE INDEX "referral_links_code_idx" ON "referral_links"("code");

-- CreateIndex
CREATE INDEX "referral_links_status_idx" ON "referral_links"("status");

-- CreateIndex
CREATE INDEX "referral_link_splits_referral_link_id_idx" ON "referral_link_splits"("referral_link_id");

-- CreateIndex
CREATE INDEX "referral_rules_referral_link_id_idx" ON "referral_rules"("referral_link_id");

-- CreateIndex
CREATE INDEX "commission_obligations_payment_link_id_idx" ON "commission_obligations"("payment_link_id");

-- CreateIndex
CREATE INDEX "commission_obligations_referral_link_id_idx" ON "commission_obligations"("referral_link_id");

-- CreateIndex
CREATE INDEX "commission_obligations_stripe_event_id_idx" ON "commission_obligations"("stripe_event_id");

-- CreateIndex
CREATE INDEX "commission_obligations_status_idx" ON "commission_obligations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "commission_obligations_stripe_event_id_key" ON "commission_obligations"("stripe_event_id");

-- CreateIndex
CREATE INDEX "commission_obligation_items_commission_obligation_id_idx" ON "commission_obligation_items"("commission_obligation_id");

-- CreateIndex
CREATE INDEX "commission_obligation_items_split_id_idx" ON "commission_obligation_items"("split_id");

-- CreateIndex
CREATE INDEX "commission_obligation_items_payout_id_idx" ON "commission_obligation_items"("payout_id");

-- CreateIndex
CREATE INDEX "commission_obligation_lines_obligation_id_idx" ON "commission_obligation_lines"("obligation_id");

-- CreateIndex
CREATE INDEX "commission_obligation_lines_payee_user_id_status_idx" ON "commission_obligation_lines"("payee_user_id", "status");

-- CreateIndex
CREATE INDEX "commission_obligation_lines_payout_id_idx" ON "commission_obligation_lines"("payout_id");

-- CreateIndex
CREATE INDEX "payout_methods_organization_id_user_id_idx" ON "payout_methods"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "payout_batches_organization_id_status_idx" ON "payout_batches"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payouts_organization_id_user_id_status_idx" ON "payouts"("organization_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "payouts_batch_id_idx" ON "payouts"("batch_id");

-- CreateIndex
CREATE INDEX "deal_network_pilot_deals_user_id_idx" ON "deal_network_pilot_deals"("user_id");

-- CreateIndex
CREATE INDEX "deal_network_pilot_obligations_user_id_deal_id_idx" ON "deal_network_pilot_obligations"("user_id", "deal_id");

-- CreateIndex
CREATE INDEX "deal_network_pilot_obligations_deal_id_idx" ON "deal_network_pilot_obligations"("deal_id");

-- CreateIndex
CREATE INDEX "deal_network_pilot_obligations_participant_id_idx" ON "deal_network_pilot_obligations"("participant_id");

-- CreateIndex
CREATE INDEX "deal_network_pilot_obligations_status_idx" ON "deal_network_pilot_obligations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "deal_network_pilot_participants_invite_token_key" ON "deal_network_pilot_participants"("invite_token");

-- CreateIndex
CREATE INDEX "deal_network_pilot_participants_deal_id_idx" ON "deal_network_pilot_participants"("deal_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fx_snapshots" ADD CONSTRAINT "fx_snapshots_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_settings" ADD CONSTRAINT "merchant_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_pilot_deal_id_fkey" FOREIGN KEY ("pilot_deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_pilot_deal_id_fkey" FOREIGN KEY ("pilot_deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_payment_confirmations" ADD CONSTRAINT "crypto_payment_confirmations_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_bank_payment_confirmations" ADD CONSTRAINT "manual_bank_payment_confirmations_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xero_syncs" ADD CONSTRAINT "xero_syncs_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_configs" ADD CONSTRAINT "currency_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fx_rate_overrides" ADD CONSTRAINT "fx_rate_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_display_preferences" ADD CONSTRAINT "currency_display_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multi_currency_invoices" ADD CONSTRAINT "multi_currency_invoices_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_link_splits" ADD CONSTRAINT "referral_link_splits_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rules" ADD CONSTRAINT "referral_rules_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligations" ADD CONSTRAINT "commission_obligations_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligations" ADD CONSTRAINT "commission_obligations_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligation_items" ADD CONSTRAINT "commission_obligation_items_commission_obligation_id_fkey" FOREIGN KEY ("commission_obligation_id") REFERENCES "commission_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligation_items" ADD CONSTRAINT "commission_obligation_items_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "referral_link_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligation_items" ADD CONSTRAINT "commission_obligation_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligation_lines" ADD CONSTRAINT "commission_obligation_lines_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "commission_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligation_lines" ADD CONSTRAINT "commission_obligation_lines_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_methods" ADD CONSTRAINT "payout_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payout_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_method_id_fkey" FOREIGN KEY ("payout_method_id") REFERENCES "payout_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_network_pilot_obligations" ADD CONSTRAINT "deal_network_pilot_obligations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_network_pilot_obligations" ADD CONSTRAINT "deal_network_pilot_obligations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "deal_network_pilot_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_network_pilot_obligations" ADD CONSTRAINT "deal_network_pilot_obligations_payment_event_id_fkey" FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_network_pilot_participants" ADD CONSTRAINT "deal_network_pilot_participants_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

