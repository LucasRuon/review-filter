-- Migration 004: Invoices Table
-- Local cache of Stripe invoices for performance and offline access

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'brl',
    status TEXT NOT NULL,
    description TEXT,
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
