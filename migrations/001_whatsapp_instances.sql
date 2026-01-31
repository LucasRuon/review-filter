-- Migration: Criar tabela whatsapp_instances e migrar dados existentes
-- Data: 2026-01-30
-- Descricao: Permite multiplas instancias WhatsApp por usuario, cada uma vinculada a um cliente

-- 1. Criar tabela whatsapp_instances (se nao existir)
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,

    -- Dados UAZAPI
    instance_name TEXT NOT NULL UNIQUE,
    instance_token TEXT,
    status TEXT DEFAULT 'disconnected',
    qrcode TEXT,

    -- Configuracoes de envio
    send_to_type TEXT DEFAULT 'contact',
    send_to_jid TEXT,

    -- Templates de mensagem
    message_new_complaint TEXT,
    message_in_progress TEXT,
    message_resolved TEXT,

    -- Configuracoes de notificacao
    notify_new_complaint INTEGER DEFAULT 1,
    notify_status_change INTEGER DEFAULT 1,

    -- Billing
    is_free INTEGER DEFAULT 0,
    stripe_subscription_item_id TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 39.90,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Criar indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_client_id ON whatsapp_instances(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);

-- Constraint unica: cada cliente pode ter apenas 1 instancia
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_user_client
ON whatsapp_instances(user_id, client_id)
WHERE client_id IS NOT NULL;

-- 3. Migrar dados existentes da tabela integrations
-- Para cada usuario que tem WhatsApp configurado, criar uma instancia gratuita
INSERT INTO whatsapp_instances (
    user_id,
    client_id,
    instance_name,
    instance_token,
    status,
    qrcode,
    send_to_type,
    send_to_jid,
    message_new_complaint,
    message_in_progress,
    message_resolved,
    notify_new_complaint,
    notify_status_change,
    is_free,
    created_at,
    updated_at
)
SELECT
    i.user_id,
    -- Vincular ao primeiro cliente do usuario (se tiver apenas 1)
    (
        SELECT c.id FROM clients c
        WHERE c.user_id = i.user_id
        ORDER BY c.created_at
        LIMIT 1
    ) as client_id,
    i.whatsapp_instance_name,
    i.whatsapp_token,
    COALESCE(i.whatsapp_status, 'disconnected'),
    i.whatsapp_qrcode,
    COALESCE(i.whatsapp_send_to_type, 'contact'),
    i.whatsapp_send_to_jid,
    i.whatsapp_message,
    i.whatsapp_message_in_progress,
    i.whatsapp_message_resolved,
    COALESCE(i.whatsapp_notify_new_complaint, 1),
    COALESCE(i.whatsapp_notify_status_change, 1),
    1, -- is_free = true (instancia migrada e gratuita)
    i.created_at,
    i.updated_at
FROM integrations i
WHERE i.whatsapp_instance_name IS NOT NULL
AND i.whatsapp_token IS NOT NULL
AND NOT EXISTS (
    -- Evitar duplicatas se migration rodar novamente
    SELECT 1 FROM whatsapp_instances wi
    WHERE wi.instance_name = i.whatsapp_instance_name
);

-- 4. Adicionar feature flag para multi-whatsapp
INSERT INTO platform_settings (key, value)
VALUES ('feature_multi_whatsapp', '1')
ON CONFLICT (key) DO NOTHING;

-- 5. Log da migracao
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM whatsapp_instances
    WHERE is_free = 1;

    RAISE NOTICE 'Migration completed: % WhatsApp instances migrated', migrated_count;
END $$;
