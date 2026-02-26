-- Add refund-related enum values for Stripe refunds (launch-safe minimal model).
-- REFUND_CONFIRMED: one row per refund event; amount_received = refund amount (positive).
-- PARTIALLY_REFUNDED / REFUNDED: payment_links.status after partial or full refund.

ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'REFUND_CONFIRMED';

ALTER TYPE "PaymentLinkStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentLinkStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
