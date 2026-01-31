-- ============================================
-- CONFIGURAÇÃO DE PRICE IDs - STRIPE
-- Execute: psql postgresql://localhost:5432/review_filter -f configure-prices.sql
-- ============================================

-- Configurar Price ID do Starter como PRO Mensal
UPDATE platform_settings
SET value = 'price_1SowDo1T9tv9oH8YxTfwyXgP'
WHERE key = 'stripe_price_id_pro_monthly';

-- Por enquanto deixar os outros vazios (criar depois no Stripe)
UPDATE platform_settings SET value = '' WHERE key = 'stripe_price_id_pro_yearly';
UPDATE platform_settings SET value = '' WHERE key = 'stripe_price_id_enterprise_monthly';
UPDATE platform_settings SET value = '' WHERE key = 'stripe_price_id_enterprise_yearly';

-- Verificar se foi configurado
SELECT
    key,
    value,
    CASE
        WHEN value = '' THEN '⚠️  Não configurado'
        WHEN value LIKE 'price_%' THEN '✅ Configurado'
        ELSE '❌ Inválido'
    END as status
FROM platform_settings
WHERE key LIKE '%stripe_price%'
ORDER BY key;

-- Mostrar resumo
SELECT
    '✅ Price ID PRO Mensal configurado!' as message
WHERE EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'stripe_price_id_pro_monthly'
    AND value = 'price_1SowDo1T9tv9oH8YxTfwyXgP'
);

-- ============================================
-- PRÓXIMOS PASSOS
-- ============================================
-- 1. Criar preço ANUAL no Stripe para o produto Starter (com 20% desconto)
-- 2. Criar produto Enterprise (opcional, para o futuro)
-- 3. Voltar aqui e atualizar os outros price IDs quando criar
-- ============================================
