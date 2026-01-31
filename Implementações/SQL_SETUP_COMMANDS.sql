-- ============================================
-- SCRIPT DE SETUP COMPLETO - STRIPE SUBSCRIPTION
-- Execute este arquivo após rodar as migrations
-- ============================================

-- 1. Verificar se as migrations foram executadas corretamente
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
      'trial_started_at',
      'trial_reminder_sent',
      'billing_email',
      'last_payment_at',
      'cancellation_reason'
  );

-- Deve retornar 5 linhas

-- 2. Verificar se as tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('subscription_history', 'invoices');

-- Deve retornar 2 linhas

-- 3. Verificar platform_settings
SELECT key, value
FROM platform_settings
WHERE key LIKE '%trial%' OR key LIKE '%price%';

-- 4. ATUALIZAR PRICE IDs DO STRIPE (OBRIGATÓRIO)
-- Substitua os valores 'price_xxxxx' pelos IDs reais do Stripe Dashboard

UPDATE platform_settings SET value = 'price_xxxxx' WHERE key = 'stripe_price_id_pro_monthly';
UPDATE platform_settings SET value = 'price_xxxxx' WHERE key = 'stripe_price_id_pro_yearly';
UPDATE platform_settings SET value = 'price_xxxxx' WHERE key = 'stripe_price_id_enterprise_monthly';
UPDATE platform_settings SET value = 'price_xxxxx' WHERE key = 'stripe_price_id_enterprise_yearly';

-- 5. Verificar configuração dos limites de plano (já devem existir)
SELECT key, value
FROM platform_settings
WHERE key LIKE 'max_%' OR key LIKE 'feature_%';

-- Se não existirem, adicione os limites:
-- Para plano FREE (já deve existir, apenas verificar)
INSERT INTO platform_settings (key, value) VALUES ('max_clients_free', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_branches_free', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_topics_free', '5') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_whatsapp_free', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_webhook_free', 'false') ON CONFLICT (key) DO NOTHING;

-- Para plano PRO
INSERT INTO platform_settings (key, value) VALUES ('max_clients_pro', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_branches_pro', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_topics_pro', '50') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_complaints_pro', '10000') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_whatsapp_pro', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_webhook_pro', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_export_pro', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_reports_pro', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_custom_domain_pro', 'false') ON CONFLICT (key) DO NOTHING;

-- Para plano ENTERPRISE
INSERT INTO platform_settings (key, value) VALUES ('max_clients_enterprise', '-1') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_branches_enterprise', '-1') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_topics_enterprise', '-1') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('max_complaints_enterprise', '-1') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_whatsapp_enterprise', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_webhook_enterprise', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_export_enterprise', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_reports_enterprise', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('feature_custom_domain_enterprise', 'true') ON CONFLICT (key) DO NOTHING;

-- 6. MIGRAR USUÁRIOS EXISTENTES PARA TRIAL (OPCIONAL)
-- Se você quiser dar trial aos usuários já cadastrados:

-- UPDATE users
-- SET
--     subscription_status = 'trial',
--     subscription_plan = 'pro',
--     trial_started_at = NOW(),
--     subscription_ends_at = NOW() + INTERVAL '14 days',
--     trial_reminder_sent = 0
-- WHERE subscription_status IS NULL OR subscription_status = 'free';

-- 7. Consulta útil: Ver status de todos os usuários
SELECT
    id,
    name,
    email,
    subscription_status,
    subscription_plan,
    trial_started_at,
    subscription_ends_at,
    CASE
        WHEN subscription_ends_at IS NOT NULL
        THEN EXTRACT(DAY FROM (subscription_ends_at - NOW()))
        ELSE NULL
    END as days_remaining
FROM users
ORDER BY created_at DESC
LIMIT 20;

-- 8. Consulta útil: Ver eventos de subscription
SELECT
    sh.id,
    sh.user_id,
    u.email,
    sh.event_type,
    sh.old_status,
    sh.new_status,
    sh.created_at
FROM subscription_history sh
JOIN users u ON sh.user_id = u.id
ORDER BY sh.created_at DESC
LIMIT 50;

-- 9. Consulta útil: Usuários com trial expirando em 3 dias
SELECT
    id,
    name,
    email,
    subscription_ends_at,
    trial_reminder_sent,
    EXTRACT(DAY FROM (subscription_ends_at - NOW())) as days_remaining
FROM users
WHERE subscription_status = 'trial'
  AND subscription_ends_at IS NOT NULL
  AND subscription_ends_at > NOW()
  AND subscription_ends_at <= NOW() + INTERVAL '3 days';

-- 10. Consulta útil: Usuários com trial expirado
SELECT
    id,
    name,
    email,
    subscription_ends_at,
    subscription_status
FROM users
WHERE subscription_status = 'trial'
  AND subscription_ends_at IS NOT NULL
  AND subscription_ends_at < NOW();

-- ============================================
-- FIM DO SCRIPT DE SETUP
-- ============================================

-- PRÓXIMOS PASSOS:
-- 1. Executar: npm install node-cron
-- 2. Adicionar no server.js:
--    const subscriptionJobs = require('./jobs/subscription-jobs');
--    subscriptionJobs.initJobs();
-- 3. Configurar Price IDs no Stripe Dashboard
-- 4. Atualizar os valores acima (UPDATE platform_settings)
-- 5. Reiniciar o servidor
-- 6. Testar criando novo usuário
