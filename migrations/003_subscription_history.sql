-- Migration 003: Subscription History Table
-- Audit log for all subscription-related events

CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_plan TEXT,
    new_plan TEXT,
    stripe_event_id TEXT UNIQUE,
    stripe_invoice_id TEXT,
    amount_paid INTEGER,
    currency TEXT DEFAULT 'brl',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_event_type ON subscription_history(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at);
