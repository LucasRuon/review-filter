/**
 * Script seguro para executar migrations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: 'postgresql://localhost:5432/review_filter'
});

async function runMigrations() {
    console.log('🚀 Iniciando migrations do Stripe...\n');

    try {
        // Migration 1: Campos adicionais em users
        console.log('▶️  1/4 - Adicionando campos em users...');
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminder_sent INTEGER DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_email TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

            CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
            CREATE INDEX IF NOT EXISTS idx_users_subscription_ends_at ON users(subscription_ends_at);
            CREATE INDEX IF NOT EXISTS idx_users_trial_started_at ON users(trial_started_at);
        `);
        console.log('✅ Campos em users adicionados!\n');

        // Migration 2: Tabela subscription_history
        console.log('▶️  2/4 - Criando tabela subscription_history...');
        await pool.query(`
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
        `);
        console.log('✅ Tabela subscription_history criada!\n');

        // Migration 3: Tabela invoices
        console.log('▶️  3/4 - Criando tabela invoices...');
        await pool.query(`
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
        `);
        console.log('✅ Tabela invoices criada!\n');

        // Migration 4: Platform settings
        console.log('▶️  4/4 - Adicionando platform settings...');
        await pool.query(`
            INSERT INTO platform_settings (key, value) VALUES
                ('trial_reminder_days', '3'),
                ('grace_period_days', '7'),
                ('enable_yearly_discount', 'true'),
                ('yearly_discount_percent', '20'),
                ('pro_monthly_price_brl', '9700'),
                ('pro_yearly_price_brl', '93120'),
                ('enterprise_monthly_price_brl', '29700'),
                ('enterprise_yearly_price_brl', '285120'),
                ('stripe_price_id_pro_monthly', ''),
                ('stripe_price_id_pro_yearly', ''),
                ('stripe_price_id_enterprise_monthly', ''),
                ('stripe_price_id_enterprise_yearly', '')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('✅ Platform settings adicionadas!\n');

        // Verificação
        console.log('🔍 Verificando instalação...\n');

        const columnsResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('trial_started_at', 'billing_email', 'cancellation_reason')
        `);

        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name IN ('subscription_history', 'invoices')
        `);

        console.log(`✅ Novas colunas em users: ${columnsResult.rows.length}/3`);
        console.log(`✅ Novas tabelas criadas: ${tablesResult.rows.length}/2`);

        console.log('\n🎉 Todas as migrations foram executadas com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

runMigrations();
