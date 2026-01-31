/**
 * Script para executar migrations usando .env
 */

require('dotenv').config();
const { Pool } = require('pg');

// Usar DATABASE_URL do .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
    console.log('🚀 Iniciando migrations do Stripe...');
    console.log('📡 Conectando ao banco:', process.env.DATABASE_URL?.split('@')[1] || 'database');
    console.log('');

    try {
        // Testar conexão
        await pool.query('SELECT NOW()');
        console.log('✅ Conexão com banco estabelecida!\n');

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

        // Configurar Price ID do Starter
        console.log('▶️  5/5 - Configurando Price ID do produto Starter...');
        await pool.query(`
            UPDATE platform_settings
            SET value = 'price_1SowDo1T9tv9oH8YxTfwyXgP'
            WHERE key = 'stripe_price_id_pro_monthly';
        `);
        console.log('✅ Price ID configurado!\n');

        // Verificação
        console.log('🔍 Verificando instalação...\n');

        const columnsResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('trial_started_at', 'billing_email', 'cancellation_reason')
            ORDER BY column_name
        `);

        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('subscription_history', 'invoices')
            ORDER BY table_name
        `);

        const priceResult = await pool.query(`
            SELECT key, value
            FROM platform_settings
            WHERE key = 'stripe_price_id_pro_monthly'
        `);

        console.log('📊 Resultados:');
        console.log(`   ✅ Colunas em users: ${columnsResult.rows.length}/3`);
        columnsResult.rows.forEach(row => console.log(`      - ${row.column_name}`));

        console.log(`   ✅ Tabelas criadas: ${tablesResult.rows.length}/2`);
        tablesResult.rows.forEach(row => console.log(`      - ${row.table_name}`));

        console.log(`   ✅ Price ID: ${priceResult.rows[0]?.value || 'não configurado'}`);

        console.log('\n🎉 SUCESSO! Todas as migrations foram executadas!');
        console.log('\n📋 Próximos passos:');
        console.log('   1. Instalar Stripe CLI: brew install stripe/stripe-cli/stripe');
        console.log('   2. Executar: stripe listen --forward-to localhost:3000/api/billing/webhook');
        console.log('   3. Copiar o whsec_xxx e adicionar no .env');
        console.log('   4. Adicionar jobs no server.js');
        console.log('   5. Reiniciar servidor e testar!');

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Dica: Verifique se o DATABASE_URL no .env está correto');
            console.error('   DATABASE_URL atual:', process.env.DATABASE_URL);
        }
    } finally {
        await pool.end();
    }
}

runMigrations();
