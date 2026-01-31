-- =============================================================================
-- SETUP COMPLETO DO STRIPE - Execute este script no banco de dados Railway
-- =============================================================================
-- Conexao: postgresql://postgres:ibBpJXMsVXtFgYsMOmMTwMkCoKIgahGA@yamabiko.proxy.rlwy.net:27303/railway
-- =============================================================================

-- 1. CRIAR TABELA platform_settings SE NAO EXISTIR
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CRIAR TABELA subscription_history SE NAO EXISTIR
CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_plan TEXT,
    new_plan TEXT,
    stripe_event_id TEXT,
    stripe_invoice_id TEXT,
    amount_paid INTEGER,
    currency TEXT DEFAULT 'brl',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. CRIAR TABELA invoices SE NAO EXISTIR
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    stripe_invoice_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    amount INTEGER,
    currency TEXT DEFAULT 'brl',
    status TEXT,
    description TEXT,
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. ADICIONAR COLUNAS DE SUBSCRIPTION NA TABELA USERS (se nao existirem)
DO $$
BEGIN
    -- Colunas de trial
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='trial_started_at') THEN
        ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='trial_reminder_sent') THEN
        ALTER TABLE users ADD COLUMN trial_reminder_sent INTEGER DEFAULT 0;
    END IF;

    -- Colunas de pagamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_payment_method_id') THEN
        ALTER TABLE users ADD COLUMN stripe_payment_method_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='billing_email') THEN
        ALTER TABLE users ADD COLUMN billing_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_payment_at') THEN
        ALTER TABLE users ADD COLUMN last_payment_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payment_failed_at') THEN
        ALTER TABLE users ADD COLUMN payment_failed_at TIMESTAMP;
    END IF;

    -- Colunas de cancelamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cancellation_reason') THEN
        ALTER TABLE users ADD COLUMN cancellation_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cancelled_at') THEN
        ALTER TABLE users ADD COLUMN cancelled_at TIMESTAMP;
    END IF;

    -- Colunas de subscription
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_status') THEN
        ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_plan') THEN
        ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'free';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_customer_id') THEN
        ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_subscription_id') THEN
        ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_ends_at') THEN
        ALTER TABLE users ADD COLUMN subscription_ends_at TIMESTAMP;
    END IF;
END $$;

-- 5. INSERIR CONFIGURACOES DA PLATAFORMA
INSERT INTO platform_settings (key, value) VALUES
    -- Configuracoes de trial e billing
    ('trial_reminder_days', '3'),
    ('grace_period_days', '7'),
    ('enable_yearly_discount', 'true'),
    ('yearly_discount_percent', '20'),
    ('trial_days', '14'),
    -- Precos em centavos
    ('pro_monthly_price_brl', '9700'),
    ('pro_yearly_price_brl', '93120'),
    ('enterprise_monthly_price_brl', '29700'),
    ('enterprise_yearly_price_brl', '285120'),
    -- Stripe Price IDs
    ('stripe_price_id_pro_monthly', ''),
    ('stripe_price_id_pro_yearly', ''),
    ('stripe_price_id_enterprise_monthly', ''),
    ('stripe_price_id_enterprise_yearly', ''),
    -- Limites plano FREE
    ('max_clients_free', '1'),
    ('max_branches_free', '1'),
    ('max_topics_free', '5'),
    ('max_complaints_free', '100'),
    ('feature_whatsapp_free', 'false'),
    ('feature_webhook_free', 'false'),
    ('feature_custom_domain_free', 'false'),
    ('feature_export_free', 'false'),
    ('feature_reports_free', 'false'),
    -- Limites plano TRIAL (igual PRO)
    ('max_clients_trial', '10'),
    ('max_branches_trial', '10'),
    ('max_topics_trial', '999999'),
    ('max_complaints_trial', '999999'),
    ('feature_whatsapp_trial', 'true'),
    ('feature_webhook_trial', 'true'),
    ('feature_custom_domain_trial', 'false'),
    ('feature_export_trial', 'true'),
    ('feature_reports_trial', 'true'),
    -- Limites plano PRO
    ('max_clients_pro', '10'),
    ('max_branches_pro', '10'),
    ('max_topics_pro', '999999'),
    ('max_complaints_pro', '999999'),
    ('feature_whatsapp_pro', 'true'),
    ('feature_webhook_pro', 'true'),
    ('feature_custom_domain_pro', 'false'),
    ('feature_export_pro', 'true'),
    ('feature_reports_pro', 'true'),
    -- Limites plano ENTERPRISE
    ('max_clients_enterprise', '999999'),
    ('max_branches_enterprise', '999999'),
    ('max_topics_enterprise', '999999'),
    ('max_complaints_enterprise', '999999'),
    ('feature_whatsapp_enterprise', 'true'),
    ('feature_webhook_enterprise', 'true'),
    ('feature_custom_domain_enterprise', 'true'),
    ('feature_export_enterprise', 'true'),
    ('feature_reports_enterprise', 'true')
ON CONFLICT (key) DO NOTHING;

-- 6. CONFIGURAR O PRICE ID DO PLANO PRO MENSAL
-- IMPORTANTE: Substitua pelo seu Price ID real do Stripe
UPDATE platform_settings
SET value = 'price_1SowDo1T9tv9oH8YxTfwyXgP', updated_at = NOW()
WHERE key = 'stripe_price_id_pro_monthly';

-- 7. VERIFICAR CONFIGURACAO
SELECT
    key,
    CASE
        WHEN value = '' THEN '(vazio)'
        WHEN value IS NULL THEN '(null)'
        ELSE value
    END as value
FROM platform_settings
WHERE key LIKE '%stripe%' OR key LIKE '%price%' OR key LIKE '%trial%'
ORDER BY key;

-- 8. VERIFICAR COLUNAS DA TABELA USERS
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN (
    'subscription_status', 'subscription_plan', 'subscription_ends_at',
    'stripe_customer_id', 'stripe_subscription_id', 'trial_started_at'
)
ORDER BY column_name;
