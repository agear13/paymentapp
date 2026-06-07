-- Operator manual invoice settlement (R1): event-level payment_method for confirmPayment(provider: manual).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MANUAL';
