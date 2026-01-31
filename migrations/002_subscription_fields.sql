-- Migration 002: Additional Subscription Fields
-- Adds trial and billing related fields to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminder_sent INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_ends_at ON users(subscription_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_trial_started_at ON users(trial_started_at);
