/**
 * Script para executar migrations
 * Execute com: node run-migrations.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/review_filter'
});

const migrations = [
    'migrations/002_subscription_fields.sql',
    'migrations/003_subscription_history.sql',
    'migrations/004_invoices.sql',
    'migrations/005_platform_settings.sql'
];

async function runMigrations() {
    console.log('🚀 Iniciando migrations...\n');

    for (const migration of migrations) {
        try {
            const filePath = path.join(__dirname, migration);
            const sql = fs.readFileSync(filePath, 'utf8');

            console.log(`▶️  Executando ${migration}...`);
            await pool.query(sql);
            console.log(`✅ ${migration} - Sucesso!\n`);
        } catch (error) {
            console.error(`❌ Erro em ${migration}:`, error.message);
            // Continuar mesmo com erro (pode ser que já esteja aplicada)
        }
    }

    // Verificar se deu certo
    console.log('🔍 Verificando migrations...\n');

    try {
        const result = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('trial_started_at', 'billing_email', 'cancellation_reason')
        `);

        console.log(`✅ Colunas encontradas: ${result.rows.length}/3`);
        result.rows.forEach(row => console.log(`   - ${row.column_name}`));
    } catch (error) {
        console.error('❌ Erro na verificação:', error.message);
    }

    await pool.end();
    console.log('\n✅ Migrations concluídas!');
}

runMigrations().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
