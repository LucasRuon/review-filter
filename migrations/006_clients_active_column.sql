-- Migration: Add active column to clients table for subscription-based access control
-- When subscription expires/cancels, clients.active is set to 0 to disable review pages

ALTER TABLE clients ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1;

-- Index for efficient filtering by active status
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active);

-- Ensure all existing clients are active
UPDATE clients SET active = 1 WHERE active IS NULL;
