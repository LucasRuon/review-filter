const { Pool } = require('pg');
const cache = require('./services/cache-service');

// Configuracao do pool de conexoes PostgreSQL com otimizacoes
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

    // Configuracoes de pool para performance
    max: 20,                        // Maximo de conexoes no pool
    min: 2,                         // Minimo de conexoes mantidas
    idleTimeoutMillis: 30000,       // Fecha conexoes ociosas apos 30s
    connectionTimeoutMillis: 10000, // Timeout para obter conexao: 10s
    maxUses: 7500,                  // Recicla conexao apos 7500 queries
});

// Handler de erros do pool
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Closing database pool...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Closing database pool...');
    await pool.end();
    process.exit(0);
});

// Templates de tópicos por nicho
const NICHE_TEMPLATES = {
    restaurant: {
        name: 'Restaurante / Food Service',
        topics: [
            { name: 'Atendimento', icon: '👋' },
            { name: 'Qualidade da comida', icon: '🍽️' },
            { name: 'Tempo de espera', icon: '⏱️' },
            { name: 'Limpeza', icon: '🧹' },
            { name: 'Preço', icon: '💰' },
            { name: 'Delivery', icon: '🛵' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    retail: {
        name: 'Loja / Varejo',
        topics: [
            { name: 'Atendimento', icon: '👋' },
            { name: 'Qualidade do produto', icon: '📦' },
            { name: 'Preço', icon: '💰' },
            { name: 'Troca/Devolução', icon: '🔄' },
            { name: 'Disponibilidade', icon: '📋' },
            { name: 'Entrega', icon: '🚚' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    clinic: {
        name: 'Clínica / Saúde',
        topics: [
            { name: 'Atendimento recepção', icon: '👋' },
            { name: 'Atendimento médico', icon: '👨‍⚕️' },
            { name: 'Tempo de espera', icon: '⏱️' },
            { name: 'Agendamento', icon: '📅' },
            { name: 'Limpeza', icon: '🧹' },
            { name: 'Preço', icon: '💰' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    beauty: {
        name: 'Salão / Estética',
        topics: [
            { name: 'Atendimento', icon: '👋' },
            { name: 'Qualidade do serviço', icon: '✨' },
            { name: 'Tempo de espera', icon: '⏱️' },
            { name: 'Agendamento', icon: '📅' },
            { name: 'Limpeza', icon: '🧹' },
            { name: 'Preço', icon: '💰' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    hotel: {
        name: 'Hotel / Hospedagem',
        topics: [
            { name: 'Atendimento', icon: '👋' },
            { name: 'Limpeza do quarto', icon: '🛏️' },
            { name: 'Café da manhã', icon: '☕' },
            { name: 'Check-in/Check-out', icon: '🔑' },
            { name: 'Instalações', icon: '🏊' },
            { name: 'Wi-Fi', icon: '📶' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    automotive: {
        name: 'Oficina / Automotivo',
        topics: [
            { name: 'Atendimento', icon: '👋' },
            { name: 'Qualidade do serviço', icon: '🔧' },
            { name: 'Prazo de entrega', icon: '⏱️' },
            { name: 'Preço', icon: '💰' },
            { name: 'Garantia', icon: '📜' },
            { name: 'Peças', icon: '⚙️' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    tech: {
        name: 'Tecnologia / Software',
        topics: [
            { name: 'Suporte técnico', icon: '🛠️' },
            { name: 'Bugs/Erros', icon: '🐛' },
            { name: 'Usabilidade', icon: '📱' },
            { name: 'Performance', icon: '⚡' },
            { name: 'Cobrança', icon: '💰' },
            { name: 'Funcionalidades', icon: '✨' },
            { name: 'Outro', icon: '💬' }
        ]
    },
    general: {
        name: 'Geral',
        topics: [
            { name: 'Atendimento', icon: '👋' },
            { name: 'Qualidade', icon: '⭐' },
            { name: 'Preço', icon: '💰' },
            { name: 'Prazo', icon: '⏱️' },
            { name: 'Comunicação', icon: '💬' },
            { name: 'Outro', icon: '📝' }
        ]
    }
};

async function init() {
    const client = await pool.connect();
    try {
        // Criar tabelas
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                phone TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                phone TEXT NOT NULL,
                google_review_link TEXT NOT NULL,
                business_hours TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                logo_url TEXT,
                primary_color TEXT DEFAULT '#3750F0',
                custom_domain TEXT,
                niche TEXT DEFAULT 'general',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS client_branches (
                id SERIAL PRIMARY KEY,
                client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                phone TEXT,
                business_hours TEXT,
                is_main INTEGER DEFAULT 0,
                active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS complaint_topics (
                id SERIAL PRIMARY KEY,
                client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💬',
                active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS complaints (
                id SERIAL PRIMARY KEY,
                client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                topic_id INTEGER REFERENCES complaint_topics(id),
                topic_name TEXT,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                complaint_text TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                resolved_at TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS integrations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                whatsapp_number TEXT,
                whatsapp_message TEXT,
                whatsapp_instance_name TEXT,
                whatsapp_token TEXT,
                whatsapp_status TEXT DEFAULT 'disconnected',
                whatsapp_qrcode TEXT,
                whatsapp_send_to_type TEXT DEFAULT 'contact',
                whatsapp_send_to_jid TEXT,
                webhook_url TEXT,
                webhook_header TEXT,
                whatsapp_notify_new_complaint INTEGER DEFAULT 1,
                whatsapp_notify_status_change INTEGER DEFAULT 1,
                whatsapp_message_in_progress TEXT,
                whatsapp_message_resolved TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Tabela de administradores
        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            )
        `);

        // Tabela de logs do sistema
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                target_user_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Tabela de configurações da plataforma
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                id SERIAL PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Tabela de feedbacks/sugestões dos usuários
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_feedbacks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL DEFAULT 'suggestion',
                rating INTEGER,
                message TEXT,
                status TEXT DEFAULT 'new',
                admin_notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Campos de assinatura na tabela de usuários (preparação para Stripe)
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free'
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_feedback_at TIMESTAMP
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT
        `);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP
        `);

        // Inserir configurações padrão
        const defaultSettings = [
            // Suporte
            ['support_whatsapp', '5548999999999'],
            ['support_email', 'contato@opinaja.com.br'],
            // Sistema
            ['maintenance_mode', 'false'],
            ['allow_registrations', 'true'],
            ['require_email_verification', 'false'],
            // Landing Page
            ['landing_title', 'Proteja sua reputação online'],
            ['landing_subtitle', 'Direcione avaliações negativas para um canal privado'],
            // Trial/Planos
            ['trial_days', '14'],
            ['default_plan', 'free'],
            ['max_clients_free', '1'],
            ['max_clients_pro', '10'],
            // NPS/Feedback
            ['nps_popup_days', '14'],
            ['nps_enabled', 'true'],
            // Limites
            ['max_complaints_per_client', '1000'],
            ['max_branches_per_client', '10'],
            ['max_topics_per_client', '20'],
            // Email - Resend API (funciona no Railway)
            ['resend_api_key', process.env.RESEND_API_KEY || ''],
            ['email_from', 'noreply@opinaja.com.br'], // Domínio verificado no Resend
            ['smtp_enabled', 'false'],
            ['smtp_host', 'smtp.gmail.com'],
            ['smtp_port', '465'],
            ['smtp_user', ''],
            ['smtp_pass', ''],
            ['smtp_from', ''],
            // Google
            ['google_review_url_template', 'https://search.google.com/local/writereview?placeid='],
            // Aparência
            ['primary_color', '#3750F0'],
            ['accent_color', '#10B981']
        ];
        // Configurações de email devem ser atualizadas se já existirem
        const emailKeys = ['resend_api_key', 'email_from', 'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'];

        for (const [key, value] of defaultSettings) {
            // Inserir configurações padrão se não existirem
            await client.query(`
                INSERT INTO platform_settings (key, value)
                VALUES ($1, $2)
                ON CONFLICT (key) DO NOTHING
            `, [key, value]);
        }

        // Atualizar Resend API key se configurada via variável de ambiente
        if (process.env.RESEND_API_KEY) {
            await client.query(`
                UPDATE platform_settings
                SET value = $1, updated_at = NOW()
                WHERE key = 'resend_api_key' AND (value = '' OR value IS NULL)
            `, [process.env.RESEND_API_KEY]);
        }
        await client.query(`
            UPDATE platform_settings
            SET value = 'noreply@opinaja.com.br', updated_at = NOW()
            WHERE key = 'email_from' AND (value = '' OR value IS NULL OR value = 'noreply@app.opinaja.com.br')
        `);

        // Migrations para adicionar colunas que podem não existir
        const migrations = [
            'ALTER TABLE clients ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT \'general\'',
            'ALTER TABLE complaints ADD COLUMN IF NOT EXISTS topic_id INTEGER',
            'ALTER TABLE complaints ADD COLUMN IF NOT EXISTS topic_name TEXT',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_instance_name TEXT',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_token TEXT',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT \'disconnected\'',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_qrcode TEXT',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_send_to_type TEXT DEFAULT \'contact\'',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_send_to_jid TEXT',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_notify_new_complaint INTEGER DEFAULT 1',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_notify_status_change INTEGER DEFAULT 1',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_message_in_progress TEXT',
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_message_resolved TEXT',
            // Melhoria 1: branch_id em complaints
            'ALTER TABLE complaints ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES client_branches(id) ON DELETE SET NULL',
            // Melhoria 3: google_review_link em client_branches
            'ALTER TABLE client_branches ADD COLUMN IF NOT EXISTS google_review_link TEXT'
        ];

        for (const migration of migrations) {
            try {
                await client.query(migration);
            } catch (e) {
                // Ignora erros de coluna já existente
            }
        }

        // ========== INDICES PARA PERFORMANCE ==========

        // Indice para login/autenticacao
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        `);

        // Indice para busca de usuarios ativos
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)
        `);

        // Indice para busca por token de reset
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(password_reset_token)
            WHERE password_reset_token IS NOT NULL
        `);

        // Indices para clients
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_custom_domain ON clients(custom_domain)
            WHERE custom_domain IS NOT NULL
        `);

        // Indices para complaints
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_complaints_client_id ON complaints(client_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC)
        `);

        // Indice composto para queries frequentes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_complaints_client_status ON complaints(client_id, status)
        `);

        // Indices para branches
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_branches_client_id ON client_branches(client_id)
        `);

        // Indices para topics
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_topics_client_id ON complaint_topics(client_id)
        `);

        // Indices para integrations
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id)
        `);

        // Indices para admin_logs
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC)
        `);

        // Indices para feedbacks
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON user_feedbacks(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON user_feedbacks(status)
        `);

        // ========== WHATSAPP INSTANCES (Multi-instancias por cliente) ==========
        await client.query(`
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
            )
        `);

        // Constraint unica: cada cliente pode ter apenas 1 instancia
        // (mas um cliente pode nao ter nenhuma, e uma instancia pode nao ter cliente)
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_user_client
            ON whatsapp_instances(user_id, client_id)
            WHERE client_id IS NOT NULL
        `);

        // Indices para whatsapp_instances
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_user_id ON whatsapp_instances(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_client_id ON whatsapp_instances(client_id)
            WHERE client_id IS NOT NULL
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status)
        `);

        console.log('Database indexes created');
        console.log('Database initialized');
    } finally {
        client.release();
    }
}

// User functions
async function createUser(name, email, passwordHash, phone = null) {
    const result = await pool.query(
        'INSERT INTO users (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, email, passwordHash, phone]
    );
    return { lastInsertRowid: result.rows[0].id };
}

async function getUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
}

async function getUserById(id) {
    const result = await pool.query(
        'SELECT id, name, email, phone, created_at FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

// Nova funcao otimizada para auth middleware - uma unica query
async function getUserByIdWithStatus(id) {
    const result = await pool.query(
        'SELECT id, name, email, active FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

async function updateUser(id, name, email, phone = null) {
    if (phone !== undefined) {
        await pool.query(
            'UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4',
            [name, email, phone, id]
        );
    } else {
        await pool.query(
            'UPDATE users SET name = $1, email = $2 WHERE id = $3',
            [name, email, id]
        );
    }
}

async function updateUserPassword(id, passwordHash) {
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
}

async function setPasswordResetToken(userId, token, expiresAt) {
    await pool.query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [token, expiresAt, userId]
    );
}

async function getUserByResetToken(token) {
    const result = await pool.query(
        'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
        [token]
    );
    return result.rows[0] || null;
}

async function clearPasswordResetToken(userId) {
    await pool.query(
        'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1',
        [userId]
    );
}

// Client functions
async function createClient(userId, data) {
    const result = await pool.query(`
        INSERT INTO clients (user_id, name, address, phone, google_review_link, business_hours, slug, logo_url, primary_color, custom_domain, niche)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
    `, [userId, data.name, data.address, data.phone, data.google_review_link, data.business_hours, data.slug, data.logo_url || null, data.primary_color || '#3750F0', data.custom_domain || null, data.niche || 'general']);

    const clientId = result.rows[0].id;

    // Criar tópicos padrão baseado no nicho
    const niche = data.niche || 'general';
    const template = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.general;
    for (let i = 0; i < template.topics.length; i++) {
        const topic = template.topics[i];
        await pool.query(
            'INSERT INTO complaint_topics (client_id, name, icon, sort_order) VALUES ($1, $2, $3, $4)',
            [clientId, topic.name, topic.icon, i]
        );
    }

    return { lastInsertRowid: clientId };
}

// COM LIMITE para evitar memory exhaustion (null = sem limite)
async function getClientsByUserId(userId, limit = null, offset = 0) {
    if (limit === null) {
        const result = await pool.query(
            'SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }
    const result = await pool.query(
        'SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
    );
    return result.rows;
}

async function getClientById(id, userId) {
    const result = await pool.query(
        'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
        [id, userId]
    );
    return result.rows[0] || null;
}

async function getClientBySlug(slug) {
    const result = await pool.query('SELECT * FROM clients WHERE slug = $1', [slug]);
    return result.rows[0] || null;
}

async function getClientByCustomDomain(domain) {
    const result = await pool.query('SELECT * FROM clients WHERE custom_domain = $1', [domain]);
    return result.rows[0] || null;
}

// OTIMIZADO: 3 queries -> 1 query para página de review
// Inclui verificacao de status de subscription do usuario
async function getClientDataForReview(slug) {
    const result = await pool.query(`
        SELECT
            c.id, c.name, c.address, c.phone, c.google_review_link,
            c.business_hours, c.slug, c.logo_url, c.primary_color,
            COALESCE(c.active, 1) as active,
            u.subscription_status,
            COALESCE(
                (SELECT json_agg(t.* ORDER BY t.sort_order)
                FROM complaint_topics t
                WHERE t.client_id = c.id AND t.active = 1),
                '[]'::json
            ) as topics,
            COALESCE(
                (SELECT json_agg(b.* ORDER BY b.is_main DESC, b.name)
                FROM client_branches b
                WHERE b.client_id = c.id AND b.active = 1),
                '[]'::json
            ) as branches
        FROM clients c
        JOIN users u ON c.user_id = u.id
        WHERE c.slug = $1
    `, [slug]);

    const row = result.rows[0];
    if (!row) return null;

    // Determinar se o servico esta ativo
    // Ativo se: client.active = 1 E subscription_status in ('free', 'trial', 'active')
    const isServiceActive = row.active === 1 &&
        ['free', 'trial', 'active'].includes(row.subscription_status);

    return {
        ...row,
        topics: row.topics || [],
        branches: row.branches || [],
        service_active: isServiceActive
    };
}

async function updateClient(id, userId, data) {
    await pool.query(`
        UPDATE clients SET name = $1, address = $2, phone = $3, google_review_link = $4, business_hours = $5, logo_url = $6, primary_color = $7, custom_domain = $8, niche = $9
        WHERE id = $10 AND user_id = $11
    `, [data.name, data.address, data.phone, data.google_review_link, data.business_hours, data.logo_url || null, data.primary_color || '#3750F0', data.custom_domain || null, data.niche || 'general', id, userId]);
}

async function deleteClient(id, userId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM complaints WHERE client_id = $1', [id]);
        await client.query('DELETE FROM complaint_topics WHERE client_id = $1', [id]);
        await client.query('DELETE FROM client_branches WHERE client_id = $1', [id]);
        await client.query('DELETE FROM clients WHERE id = $1 AND user_id = $2', [id, userId]);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Branch functions - COM LIMITE (null = sem limite)
async function getBranchesByClientId(clientId, limit = null) {
    if (limit === null) {
        const result = await pool.query(
            'SELECT * FROM client_branches WHERE client_id = $1 ORDER BY is_main DESC, name ASC',
            [clientId]
        );
        return result.rows;
    }
    const result = await pool.query(
        'SELECT * FROM client_branches WHERE client_id = $1 ORDER BY is_main DESC, name ASC LIMIT $2',
        [clientId, limit]
    );
    return result.rows;
}

async function getBranchById(id, clientId) {
    const result = await pool.query(
        'SELECT * FROM client_branches WHERE id = $1 AND client_id = $2',
        [id, clientId]
    );
    return result.rows[0] || null;
}

async function createBranch(clientId, data) {
    const result = await pool.query(`
        INSERT INTO client_branches (client_id, name, address, phone, business_hours, is_main, google_review_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `, [clientId, data.name, data.address, data.phone || null, data.business_hours || null, data.is_main || 0, data.google_review_link || null]);
    return { id: result.rows[0].id };
}

async function updateBranch(id, clientId, data) {
    await pool.query(`
        UPDATE client_branches
        SET name = $1, address = $2, phone = $3, business_hours = $4, is_main = $5, active = $6, google_review_link = $7
        WHERE id = $8 AND client_id = $9
    `, [data.name, data.address, data.phone || null, data.business_hours || null, data.is_main || 0, data.active !== undefined ? data.active : 1, data.google_review_link || null, id, clientId]);
}

async function deleteBranch(id, clientId) {
    await pool.query('DELETE FROM client_branches WHERE id = $1 AND client_id = $2', [id, clientId]);
}

// Topic functions - COM LIMITE
async function getTopicsByClientId(clientId, limit = 50) {
    const result = await pool.query(
        'SELECT * FROM complaint_topics WHERE client_id = $1 AND active = 1 ORDER BY sort_order LIMIT $2',
        [clientId, limit]
    );
    return result.rows;
}

async function getAllTopicsByClientId(clientId) {
    const result = await pool.query(
        'SELECT * FROM complaint_topics WHERE client_id = $1 ORDER BY sort_order',
        [clientId]
    );
    return result.rows;
}

async function createTopic(clientId, name, icon) {
    const maxOrderResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) as max FROM complaint_topics WHERE client_id = $1',
        [clientId]
    );
    const maxOrder = maxOrderResult.rows[0]?.max || 0;

    const result = await pool.query(
        'INSERT INTO complaint_topics (client_id, name, icon, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
        [clientId, name, icon || '💬', maxOrder + 1]
    );
    return { lastInsertRowid: result.rows[0].id };
}

async function updateTopic(id, clientId, data) {
    await pool.query(
        'UPDATE complaint_topics SET name = $1, icon = $2, active = $3 WHERE id = $4 AND client_id = $5',
        [data.name, data.icon || '💬', data.active ? 1 : 0, id, clientId]
    );
}

async function deleteTopic(id, clientId) {
    await pool.query('DELETE FROM complaint_topics WHERE id = $1 AND client_id = $2', [id, clientId]);
}

// COM TRANSACAO para integridade de dados
async function resetTopicsToNiche(clientId, niche) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Remove tópicos existentes
        await client.query('DELETE FROM complaint_topics WHERE client_id = $1', [clientId]);

        // Adiciona tópicos do template
        const template = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.general;
        for (let i = 0; i < template.topics.length; i++) {
            const topic = template.topics[i];
            await client.query(
                'INSERT INTO complaint_topics (client_id, name, icon, sort_order) VALUES ($1, $2, $3, $4)',
                [clientId, topic.name, topic.icon, i]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Complaint functions
async function createComplaint(clientId, data) {
    await pool.query(`
        INSERT INTO complaints (client_id, branch_id, topic_id, topic_name, customer_name, customer_email, customer_phone, complaint_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [clientId, data.branch_id || null, data.topic_id || null, data.topic_name || null, data.name, data.email, data.phone, data.complaint]);
}

// COM PAGINACAO para evitar memory exhaustion
async function getComplaintsByClientId(clientId, limit = 100, offset = 0) {
    const result = await pool.query(`
        SELECT c.*, cb.name as branch_name
        FROM complaints c
        LEFT JOIN client_branches cb ON c.branch_id = cb.id
        WHERE c.client_id = $1
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
    `, [clientId, limit, offset]);
    return result.rows;
}

async function countComplaintsByClientId(clientId) {
    const result = await pool.query(
        'SELECT COUNT(*) as count FROM complaints WHERE client_id = $1',
        [clientId]
    );
    return parseInt(result.rows[0]?.count) || 0;
}

async function getComplaintById(id, clientId = null) {
    if (clientId) {
        const result = await pool.query('SELECT * FROM complaints WHERE id = $1 AND client_id = $2', [id, clientId]);
        return result.rows[0] || null;
    }
    const result = await pool.query('SELECT * FROM complaints WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function getTopicById(id, clientId) {
    const result = await pool.query('SELECT * FROM complaint_topics WHERE id = $1 AND client_id = $2', [id, clientId]);
    return result.rows[0] || null;
}

async function updateComplaintStatus(id, clientId, status) {
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    await pool.query(
        'UPDATE complaints SET status = $1, resolved_at = $2 WHERE id = $3 AND client_id = $4',
        [status, resolvedAt, id, clientId]
    );
}

// OTIMIZADO: 5 queries -> 2 queries
async function getStats(userId) {
    // Query 1: Todas as contagens em uma única query
    const countsResult = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM clients WHERE user_id = $1) as total_clients,
            (SELECT COUNT(*) FROM complaints c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = $1) as total_complaints,
            (SELECT COUNT(*) FROM complaints c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = $1 AND c.status = 'pending') as pending_complaints,
            (SELECT COUNT(*) FROM complaints c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = $1 AND c.status = 'resolved') as resolved_complaints
    `, [userId]);

    const counts = countsResult.rows[0];

    // Query 2: Reclamações recentes
    const recentComplaintsResult = await pool.query(`
        SELECT c.*, cl.name as client_name
        FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1
        ORDER BY c.created_at DESC
        LIMIT 10
    `, [userId]);

    return {
        totalClients: parseInt(counts.total_clients) || 0,
        totalComplaints: parseInt(counts.total_complaints) || 0,
        pendingComplaints: parseInt(counts.pending_complaints) || 0,
        resolvedComplaints: parseInt(counts.resolved_complaints) || 0,
        recentComplaints: recentComplaintsResult.rows
    };
}

async function getAllComplaintsByUserId(userId, limit = 100, offset = 0) {
    const result = await pool.query(`
        SELECT c.*, cl.name as client_name, cb.name as branch_name
        FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN client_branches cb ON c.branch_id = cb.id
        WHERE cl.user_id = $1
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    return result.rows;
}

// Funcao para contar total (para paginacao)
async function countComplaintsByUserId(userId) {
    const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1
    `, [userId]);
    return parseInt(result.rows[0]?.count) || 0;
}

// Integration functions
async function getIntegrationsByUserId(userId) {
    const result = await pool.query('SELECT * FROM integrations WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
}

async function updateIntegrations(userId, data) {
    const existing = await getIntegrationsByUserId(userId);

    if (existing) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (data.whatsapp_number !== undefined) {
            updates.push(`whatsapp_number = $${paramIndex++}`);
            params.push(data.whatsapp_number);
        }
        if (data.whatsapp_message !== undefined) {
            updates.push(`whatsapp_message = $${paramIndex++}`);
            params.push(data.whatsapp_message);
        }
        if (data.whatsapp_instance_name !== undefined) {
            updates.push(`whatsapp_instance_name = $${paramIndex++}`);
            params.push(data.whatsapp_instance_name);
        }
        if (data.whatsapp_token !== undefined) {
            updates.push(`whatsapp_token = $${paramIndex++}`);
            params.push(data.whatsapp_token);
        }
        if (data.whatsapp_status !== undefined) {
            updates.push(`whatsapp_status = $${paramIndex++}`);
            params.push(data.whatsapp_status);
        }
        if (data.whatsapp_qrcode !== undefined) {
            updates.push(`whatsapp_qrcode = $${paramIndex++}`);
            params.push(data.whatsapp_qrcode);
        }
        if (data.whatsapp_send_to_type !== undefined) {
            updates.push(`whatsapp_send_to_type = $${paramIndex++}`);
            params.push(data.whatsapp_send_to_type);
        }
        if (data.whatsapp_send_to_jid !== undefined) {
            updates.push(`whatsapp_send_to_jid = $${paramIndex++}`);
            params.push(data.whatsapp_send_to_jid);
        }
        if (data.webhook_url !== undefined) {
            updates.push(`webhook_url = $${paramIndex++}`);
            params.push(data.webhook_url);
        }
        if (data.webhook_header !== undefined) {
            updates.push(`webhook_header = $${paramIndex++}`);
            params.push(data.webhook_header);
        }
        if (data.whatsapp_notify_new_complaint !== undefined) {
            updates.push(`whatsapp_notify_new_complaint = $${paramIndex++}`);
            params.push(data.whatsapp_notify_new_complaint ? 1 : 0);
        }
        if (data.whatsapp_notify_status_change !== undefined) {
            updates.push(`whatsapp_notify_status_change = $${paramIndex++}`);
            params.push(data.whatsapp_notify_status_change ? 1 : 0);
        }
        if (data.whatsapp_message_in_progress !== undefined) {
            updates.push(`whatsapp_message_in_progress = $${paramIndex++}`);
            params.push(data.whatsapp_message_in_progress);
        }
        if (data.whatsapp_message_resolved !== undefined) {
            updates.push(`whatsapp_message_resolved = $${paramIndex++}`);
            params.push(data.whatsapp_message_resolved);
        }

        updates.push(`updated_at = NOW()`);
        params.push(userId);

        await pool.query(`UPDATE integrations SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`, params);
    } else {
        await pool.query(`
            INSERT INTO integrations (
                user_id, whatsapp_number, whatsapp_message, whatsapp_instance_name,
                whatsapp_token, whatsapp_status, whatsapp_qrcode,
                whatsapp_send_to_type, whatsapp_send_to_jid,
                webhook_url, webhook_header,
                whatsapp_notify_new_complaint, whatsapp_notify_status_change,
                whatsapp_message_in_progress, whatsapp_message_resolved
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
            userId,
            data.whatsapp_number || null,
            data.whatsapp_message || null,
            data.whatsapp_instance_name || null,
            data.whatsapp_token || null,
            data.whatsapp_status || 'disconnected',
            data.whatsapp_qrcode || null,
            data.whatsapp_send_to_type || 'contact',
            data.whatsapp_send_to_jid || null,
            data.webhook_url || null,
            data.webhook_header || null,
            data.whatsapp_notify_new_complaint !== undefined ? (data.whatsapp_notify_new_complaint ? 1 : 0) : 1,
            data.whatsapp_notify_status_change !== undefined ? (data.whatsapp_notify_status_change ? 1 : 0) : 1,
            data.whatsapp_message_in_progress || null,
            data.whatsapp_message_resolved || null
        ]);
    }

    return { success: true };
}

// ========== ADMIN FUNCTIONS ==========

// Admin authentication
async function getAdminByEmail(email) {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    return result.rows[0] || null;
}

async function getAdminById(id) {
    const result = await pool.query('SELECT id, email, name, role, active, created_at, last_login FROM admins WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function createAdmin(email, passwordHash, name, role = 'admin') {
    const result = await pool.query(
        'INSERT INTO admins (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, passwordHash, name, role]
    );
    return { id: result.rows[0].id };
}

async function updateAdminLastLogin(id) {
    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [id]);
}

// Admin logs
async function createAdminLog(adminId, action, details, ipAddress, userAgent, targetUserId = null) {
    await pool.query(
        'INSERT INTO admin_logs (admin_id, action, details, ip_address, user_agent, target_user_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [adminId, action, details, ipAddress, userAgent, targetUserId]
    );
}

async function getAdminLogs(limit = 100, offset = 0) {
    const result = await pool.query(`
        SELECT l.*, a.name as admin_name, a.email as admin_email, u.name as target_user_name
        FROM admin_logs l
        LEFT JOIN admins a ON l.admin_id = a.id
        LEFT JOIN users u ON l.target_user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
}

// Platform settings - COM CACHE para performance
async function getPlatformSetting(key) {
    const cacheKey = `setting:${key}`;

    // Tentar cache primeiro
    let value = cache.get(cacheKey);
    if (value !== undefined) {
        return value;
    }

    // Buscar do banco
    const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
    value = result.rows[0]?.value || null;

    // Salvar no cache por 5 minutos
    cache.set(cacheKey, value, 300);

    return value;
}

async function getAllPlatformSettings() {
    const cacheKey = 'settings:all';

    // Tentar cache primeiro
    let settings = cache.get(cacheKey);
    if (settings !== undefined) {
        return settings;
    }

    // Buscar do banco
    const result = await pool.query('SELECT key, value FROM platform_settings');
    settings = {};
    for (const row of result.rows) {
        settings[row.key] = row.value;
    }

    // Salvar no cache por 5 minutos
    cache.set(cacheKey, settings, 300);

    return settings;
}

async function updatePlatformSetting(key, value) {
    await pool.query(`
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, value]);

    // Invalidar cache
    cache.delete(`setting:${key}`);
    cache.delete('settings:all');
}

// Admin user management - OTIMIZADO: usa LEFT JOIN ao inves de subqueries correlacionadas
async function getAllUsers(limit = 50, offset = 0, search = null) {
    let query = `
        SELECT
            u.id, u.name, u.email, u.phone, u.created_at, u.last_login, u.active,
            u.subscription_status, u.subscription_plan, u.subscription_ends_at,
            COALESCE(client_stats.clients_count, 0) as clients_count,
            COALESCE(client_stats.complaints_count, 0) as complaints_count
        FROM users u
        LEFT JOIN (
            SELECT
                c.user_id,
                COUNT(DISTINCT c.id) as clients_count,
                COUNT(comp.id) as complaints_count
            FROM clients c
            LEFT JOIN complaints comp ON comp.client_id = c.id
            GROUP BY c.user_id
        ) client_stats ON client_stats.user_id = u.id
    `;

    const params = [];

    if (search) {
        query += ` WHERE u.name ILIKE $1 OR u.email ILIKE $1`;
        params.push(`%${search}%`);
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
}

async function getTotalUsersCount(search = null) {
    let query = 'SELECT COUNT(*) as count FROM users';
    const params = [];

    if (search) {
        query += ` WHERE name ILIKE $1 OR email ILIKE $1`;
        params.push(`%${search}%`);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0]?.count) || 0;
}

// OTIMIZADO: subqueries -> LEFT JOIN
async function getUserByIdAdmin(id) {
    const result = await pool.query(`
        SELECT
            u.*,
            COALESCE(stats.clients_count, 0) as clients_count,
            COALESCE(stats.complaints_count, 0) as complaints_count
        FROM users u
        LEFT JOIN (
            SELECT
                c.user_id,
                COUNT(DISTINCT c.id) as clients_count,
                COUNT(comp.id) as complaints_count
            FROM clients c
            LEFT JOIN complaints comp ON comp.client_id = c.id
            WHERE c.user_id = $1
            GROUP BY c.user_id
        ) stats ON stats.user_id = u.id
        WHERE u.id = $1
    `, [id]);
    return result.rows[0] || null;
}

async function updateUserStatus(userId, active) {
    await pool.query('UPDATE users SET active = $1 WHERE id = $2', [active ? 1 : 0, userId]);
}

async function deleteUserAdmin(userId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Deletar em ordem correta (foreign keys)
        await client.query(`
            DELETE FROM complaints WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)
        `, [userId]);
        await client.query(`
            DELETE FROM complaint_topics WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)
        `, [userId]);
        await client.query(`
            DELETE FROM client_branches WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)
        `, [userId]);
        await client.query('DELETE FROM clients WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM integrations WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_feedbacks WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function updateUserLastLogin(userId) {
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

// Admin statistics - OTIMIZADO: 9 queries -> 2 queries
async function getAdminStats() {
    // Query 1: Todas as contagens em uma unica query
    const countsResult = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_week,
            (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_month,
            (SELECT COUNT(*) FROM users WHERE active = 1) as active_users,
            (SELECT COUNT(*) FROM clients) as total_clients,
            (SELECT COUNT(*) FROM complaints) as total_complaints
    `);

    const counts = countsResult.rows[0];

    // Query 2: Dados de crescimento e usuarios recentes
    const growthAndRecentResult = await pool.query(`
        WITH user_growth AS (
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM users
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date
        ),
        complaint_growth AS (
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM complaints
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date
        ),
        recent_users AS (
            SELECT id, name, email, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 10
        )
        SELECT
            (SELECT json_agg(user_growth.*) FROM user_growth) as user_growth,
            (SELECT json_agg(complaint_growth.*) FROM complaint_growth) as complaints_growth,
            (SELECT json_agg(recent_users.*) FROM recent_users) as recent_users
    `);

    const growth = growthAndRecentResult.rows[0];

    return {
        totalUsers: parseInt(counts.total_users) || 0,
        newUsersWeek: parseInt(counts.new_users_week) || 0,
        newUsersMonth: parseInt(counts.new_users_month) || 0,
        totalClients: parseInt(counts.total_clients) || 0,
        totalComplaints: parseInt(counts.total_complaints) || 0,
        activeUsers: parseInt(counts.active_users) || 0,
        userGrowth: growth.user_growth || [],
        complaintsGrowth: growth.complaints_growth || [],
        recentUsers: growth.recent_users || []
    };
}

// Get user's full data for impersonation
async function getUserFullData(userId) {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return user.rows[0] || null;
}

// ========== FEEDBACK FUNCTIONS ==========

async function createFeedback(userId, type, rating, message) {
    const result = await pool.query(`
        INSERT INTO user_feedbacks (user_id, type, rating, message)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `, [userId, type, rating || null, message || null]);

    // Atualizar última data de feedback do usuário
    await pool.query('UPDATE users SET last_feedback_at = NOW() WHERE id = $1', [userId]);

    return { id: result.rows[0].id };
}

async function getUserLastFeedbackDate(userId) {
    const result = await pool.query(
        'SELECT last_feedback_at FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0]?.last_feedback_at || null;
}

async function getAllFeedbacks(limit = 50, offset = 0, status = null, type = null) {
    let query = `
        SELECT f.*, u.name as user_name, u.email as user_email
        FROM user_feedbacks f
        LEFT JOIN users u ON f.user_id = u.id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
        query += ` AND f.status = $${paramIndex++}`;
        params.push(status);
    }
    if (type) {
        query += ` AND f.type = $${paramIndex++}`;
        params.push(type);
    }

    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
}

async function getFeedbackById(id) {
    const result = await pool.query(`
        SELECT f.*, u.name as user_name, u.email as user_email
        FROM user_feedbacks f
        LEFT JOIN users u ON f.user_id = u.id
        WHERE f.id = $1
    `, [id]);
    return result.rows[0] || null;
}

async function updateFeedbackStatus(id, status, adminNotes = null) {
    await pool.query(`
        UPDATE user_feedbacks
        SET status = $1, admin_notes = $2, updated_at = NOW()
        WHERE id = $3
    `, [status, adminNotes, id]);
}

// OTIMIZADO: query simplificada para evitar erros com tabela vazia
async function getFeedbackStats() {
    try {
        // Query simples para estatisticas basicas
        const basicStats = await pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'new') as new_count,
                COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0) as avg_rating
            FROM user_feedbacks
        `);

        // Query para contagem por tipo
        const typeStats = await pool.query(`
            SELECT type, COUNT(*)::int as count
            FROM user_feedbacks
            WHERE type IS NOT NULL
            GROUP BY type
        `);

        // Query para contagem por status
        const statusStats = await pool.query(`
            SELECT status, COUNT(*)::int as count
            FROM user_feedbacks
            WHERE status IS NOT NULL
            GROUP BY status
        `);

        const row = basicStats.rows[0];
        const byType = {};
        const byStatus = {};

        typeStats.rows.forEach(r => { byType[r.type] = r.count; });
        statusStats.rows.forEach(r => { byStatus[r.status] = r.count; });

        return {
            total: parseInt(row?.total) || 0,
            newCount: parseInt(row?.new_count) || 0,
            avgRating: (parseFloat(row?.avg_rating) || 0).toFixed(1),
            byType,
            byStatus
        };
    } catch (error) {
        console.error('Error getting feedback stats:', error);
        return {
            total: 0,
            newCount: 0,
            avgRating: '0.0',
            byType: {},
            byStatus: {}
        };
    }
}

async function getTotalFeedbacksCount(status = null, type = null) {
    let query = 'SELECT COUNT(*) as count FROM user_feedbacks WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
    }
    if (type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(type);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0]?.count) || 0;
}

// ========== DATABASE STATS ==========

// OTIMIZADO: loop de queries -> 1 query
async function getDatabaseStats() {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM clients) as clients,
                (SELECT COUNT(*) FROM complaints) as complaints,
                (SELECT COUNT(*) FROM client_branches) as branches,
                (SELECT COUNT(*) FROM complaint_topics) as topics,
                (SELECT COUNT(*) FROM integrations) as integrations,
                (SELECT COUNT(*) FROM user_feedbacks) as user_feedbacks,
                (SELECT COUNT(*) FROM admin_logs) as admin_logs,
                (SELECT COUNT(*) FROM admins) as admins,
                pg_size_pretty(pg_database_size(current_database())) as database_size,
                (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
        `);

        const row = result.rows[0];
        return {
            users: parseInt(row?.users) || 0,
            clients: parseInt(row?.clients) || 0,
            complaints: parseInt(row?.complaints) || 0,
            branches: parseInt(row?.branches) || 0,
            topics: parseInt(row?.topics) || 0,
            integrations: parseInt(row?.integrations) || 0,
            user_feedbacks: parseInt(row?.user_feedbacks) || 0,
            admin_logs: parseInt(row?.admin_logs) || 0,
            admins: parseInt(row?.admins) || 0,
            database_size: row?.database_size || 'N/A',
            active_connections: parseInt(row?.active_connections) || 0
        };
    } catch (e) {
        return {
            users: 0, clients: 0, complaints: 0, branches: 0, topics: 0,
            integrations: 0, user_feedbacks: 0, admin_logs: 0, admins: 0,
            database_size: 'N/A', active_connections: 0
        };
    }
}

// OTIMIZADO: Deletar em batches para nao travar o banco
async function cleanupOldData(daysToKeep = 90, batchSize = 1000) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const results = { admin_logs_deleted: 0, feedbacks_skipped_deleted: 0 };

    // Deletar logs em batches
    try {
        let deleted = 0;
        do {
            const logsResult = await pool.query(
                `DELETE FROM admin_logs
                 WHERE id IN (
                     SELECT id FROM admin_logs WHERE created_at < $1 LIMIT $2
                 ) RETURNING id`,
                [cutoffDate, batchSize]
            );
            deleted = logsResult.rowCount;
            results.admin_logs_deleted += deleted;
        } while (deleted === batchSize);
    } catch (e) {
        // Erro silencioso
    }

    // Deletar feedbacks em batches
    try {
        let deleted = 0;
        do {
            const feedbackResult = await pool.query(
                `DELETE FROM user_feedbacks
                 WHERE id IN (
                     SELECT id FROM user_feedbacks
                     WHERE type = 'nps_skipped' AND created_at < $1
                     LIMIT $2
                 ) RETURNING id`,
                [cutoffDate, batchSize]
            );
            deleted = feedbackResult.rowCount;
            results.feedbacks_skipped_deleted += deleted;
        } while (deleted === batchSize);
    } catch (e) {
        // Erro silencioso
    }

    return results;
}

// Funcao para buscar slugs por prefixo (usado em getUniqueSlug)
async function findSlugsByPrefix(prefix) {
    const result = await pool.query(
        'SELECT slug FROM clients WHERE slug LIKE $1 ORDER BY slug',
        [`${prefix}%`]
    );
    return result.rows;
}

// ========== WHATSAPP INSTANCES FUNCTIONS ==========

async function createWhatsAppInstance(userId, data) {
    const result = await pool.query(`
        INSERT INTO whatsapp_instances (
            user_id, client_id, instance_name, instance_token, status, qrcode,
            send_to_type, send_to_jid,
            message_new_complaint, message_in_progress, message_resolved,
            notify_new_complaint, notify_status_change,
            is_free, stripe_subscription_item_id, price_monthly
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
    `, [
        userId,
        data.client_id || null,
        data.instance_name,
        data.instance_token || null,
        data.status || 'disconnected',
        data.qrcode || null,
        data.send_to_type || 'contact',
        data.send_to_jid || null,
        data.message_new_complaint || null,
        data.message_in_progress || null,
        data.message_resolved || null,
        data.notify_new_complaint !== undefined ? (data.notify_new_complaint ? 1 : 0) : 1,
        data.notify_status_change !== undefined ? (data.notify_status_change ? 1 : 0) : 1,
        data.is_free ? 1 : 0,
        data.stripe_subscription_item_id || null,
        data.price_monthly || 39.90
    ]);
    return result.rows[0];
}

async function getWhatsAppInstancesByUser(userId) {
    const result = await pool.query(`
        SELECT wi.*, c.name as client_name
        FROM whatsapp_instances wi
        LEFT JOIN clients c ON wi.client_id = c.id
        WHERE wi.user_id = $1
        ORDER BY wi.is_free DESC, wi.created_at
    `, [userId]);
    return result.rows;
}

async function getWhatsAppInstanceById(instanceId, userId = null) {
    if (userId) {
        const result = await pool.query(`
            SELECT wi.*, c.name as client_name
            FROM whatsapp_instances wi
            LEFT JOIN clients c ON wi.client_id = c.id
            WHERE wi.id = $1 AND wi.user_id = $2
        `, [instanceId, userId]);
        return result.rows[0] || null;
    }
    const result = await pool.query(`
        SELECT wi.*, c.name as client_name
        FROM whatsapp_instances wi
        LEFT JOIN clients c ON wi.client_id = c.id
        WHERE wi.id = $1
    `, [instanceId]);
    return result.rows[0] || null;
}

async function getWhatsAppInstanceByClient(clientId) {
    const result = await pool.query(`
        SELECT * FROM whatsapp_instances
        WHERE client_id = $1
    `, [clientId]);
    return result.rows[0] || null;
}

async function updateWhatsAppInstance(instanceId, userId, data) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (data.client_id !== undefined) {
        updates.push(`client_id = $${paramIndex++}`);
        params.push(data.client_id);
    }
    if (data.instance_name !== undefined) {
        updates.push(`instance_name = $${paramIndex++}`);
        params.push(data.instance_name);
    }
    if (data.instance_token !== undefined) {
        updates.push(`instance_token = $${paramIndex++}`);
        params.push(data.instance_token);
    }
    if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(data.status);
    }
    if (data.qrcode !== undefined) {
        updates.push(`qrcode = $${paramIndex++}`);
        params.push(data.qrcode);
    }
    if (data.send_to_type !== undefined) {
        updates.push(`send_to_type = $${paramIndex++}`);
        params.push(data.send_to_type);
    }
    if (data.send_to_jid !== undefined) {
        updates.push(`send_to_jid = $${paramIndex++}`);
        params.push(data.send_to_jid);
    }
    if (data.message_new_complaint !== undefined) {
        updates.push(`message_new_complaint = $${paramIndex++}`);
        params.push(data.message_new_complaint);
    }
    if (data.message_in_progress !== undefined) {
        updates.push(`message_in_progress = $${paramIndex++}`);
        params.push(data.message_in_progress);
    }
    if (data.message_resolved !== undefined) {
        updates.push(`message_resolved = $${paramIndex++}`);
        params.push(data.message_resolved);
    }
    if (data.notify_new_complaint !== undefined) {
        updates.push(`notify_new_complaint = $${paramIndex++}`);
        params.push(data.notify_new_complaint ? 1 : 0);
    }
    if (data.notify_status_change !== undefined) {
        updates.push(`notify_status_change = $${paramIndex++}`);
        params.push(data.notify_status_change ? 1 : 0);
    }
    if (data.is_free !== undefined) {
        updates.push(`is_free = $${paramIndex++}`);
        params.push(data.is_free ? 1 : 0);
    }
    if (data.stripe_subscription_item_id !== undefined) {
        updates.push(`stripe_subscription_item_id = $${paramIndex++}`);
        params.push(data.stripe_subscription_item_id);
    }

    if (updates.length === 0) {
        return null;
    }

    updates.push(`updated_at = NOW()`);
    params.push(instanceId, userId);

    const result = await pool.query(`
        UPDATE whatsapp_instances
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
        RETURNING *
    `, params);

    return result.rows[0] || null;
}

async function deleteWhatsAppInstance(instanceId, userId) {
    const result = await pool.query(`
        DELETE FROM whatsapp_instances
        WHERE id = $1 AND user_id = $2
        RETURNING id
    `, [instanceId, userId]);
    return result.rowCount > 0;
}

async function countUserInstances(userId) {
    const result = await pool.query(`
        SELECT COUNT(*) as count FROM whatsapp_instances WHERE user_id = $1
    `, [userId]);
    return parseInt(result.rows[0]?.count) || 0;
}

async function hasUserFreeInstance(userId) {
    const result = await pool.query(`
        SELECT 1 FROM whatsapp_instances
        WHERE user_id = $1 AND is_free = 1
        LIMIT 1
    `, [userId]);
    return result.rows.length > 0;
}

async function getClientsWithoutInstance(userId) {
    const result = await pool.query(`
        SELECT c.id, c.name
        FROM clients c
        WHERE c.user_id = $1
        AND c.id NOT IN (
            SELECT client_id FROM whatsapp_instances
            WHERE user_id = $1 AND client_id IS NOT NULL
        )
        ORDER BY c.name
    `, [userId]);
    return result.rows;
}

// Funcao para atualizar stripe_customer_id do usuario
async function updateUserStripeCustomerId(userId, stripeCustomerId) {
    await pool.query(`
        UPDATE users SET stripe_customer_id = $1 WHERE id = $2
    `, [stripeCustomerId, userId]);
}

// Funcao para buscar usuario com dados de subscription
async function getUserWithSubscription(userId) {
    const result = await pool.query(`
        SELECT id, name, email, phone, stripe_customer_id, stripe_subscription_id,
               subscription_status, subscription_plan, subscription_ends_at
        FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0] || null;
}

// ==================== SUBSCRIPTION MANAGEMENT FUNCTIONS ====================

/**
 * Registra evento de subscription no historico
 */
async function logSubscriptionEvent(userId, eventType, metadata = {}) {
    await pool.query(`
        INSERT INTO subscription_history (user_id, event_type, metadata)
        VALUES ($1, $2, $3)
    `, [userId, eventType, JSON.stringify(metadata)]);
}

/**
 * Retorna dados completos de subscription do usuario para exibicao no perfil
 */
async function getUserSubscriptionData(userId) {
    const result = await pool.query(`
        SELECT
            id, name, email, phone,
            subscription_status,
            subscription_plan,
            stripe_customer_id,
            stripe_subscription_id,
            subscription_ends_at,
            trial_started_at,
            trial_reminder_sent,
            last_payment_at,
            payment_failed_at,
            cancellation_reason,
            cancelled_at,
            created_at
        FROM users
        WHERE id = $1
    `, [userId]);
    return result.rows[0] || null;
}

/**
 * Obtem informacoes completas de subscription
 */
async function getSubscriptionInfo(userId) {
    const result = await pool.query(`
        SELECT
            subscription_status,
            subscription_plan,
            stripe_customer_id,
            stripe_subscription_id,
            subscription_ends_at,
            trial_started_at,
            trial_reminder_sent,
            last_payment_at,
            payment_failed_at,
            cancelled_at,
            EXTRACT(DAY FROM (subscription_ends_at - NOW())) as days_remaining
        FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) return null;

    const user = result.rows[0];
    const now = new Date();
    const endsAt = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;

    return {
        status: user.subscription_status,
        plan: user.subscription_plan,
        stripeCustomerId: user.stripe_customer_id,
        stripeSubscriptionId: user.stripe_subscription_id,
        endsAt: user.subscription_ends_at,
        trialStartedAt: user.trial_started_at,
        trialReminderSent: user.trial_reminder_sent,
        lastPaymentAt: user.last_payment_at,
        paymentFailedAt: user.payment_failed_at,
        daysRemaining: Math.max(0, Math.floor(user.days_remaining || 0)),
        isTrialing: user.subscription_status === 'trial',
        isActive: ['trial', 'active'].includes(user.subscription_status),
        isExpired: user.subscription_status === 'expired' ||
                   (user.subscription_status === 'trial' && endsAt && endsAt < now),
        isPastDue: user.subscription_status === 'past_due',
        isCanceled: user.subscription_status === 'canceled',
        canceledAt: user.cancelled_at,
        // Se status é 'active' mas tem cancelled_at, está agendado para cancelar
        isCanceledAtPeriodEnd: user.subscription_status === 'active' && user.cancelled_at !== null
    };
}

/**
 * Atualiza status de subscription
 */
async function updateSubscriptionStatus(userId, status, plan = null, endsAt = null) {
    let query = `UPDATE users SET subscription_status = $1`;
    const params = [status];
    let paramIndex = 2;

    if (plan !== null) {
        query += `, subscription_plan = $${paramIndex++}`;
        params.push(plan);
    }

    if (endsAt !== null) {
        query += `, subscription_ends_at = $${paramIndex++}`;
        params.push(endsAt);
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(userId);

    await pool.query(query, params);
}

/**
 * Inicia trial para usuario
 */
async function startUserTrial(userId, trialDays = 14) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    await pool.query(`
        UPDATE users SET
            subscription_status = 'trial',
            subscription_plan = 'pro',
            trial_started_at = NOW(),
            subscription_ends_at = $1,
            trial_reminder_sent = 0
        WHERE id = $2
    `, [trialEndsAt, userId]);

    await logSubscriptionEvent(userId, 'trial_started', {
        trial_days: trialDays,
        ends_at: trialEndsAt.toISOString()
    });

    return trialEndsAt;
}

/**
 * Busca usuarios com trial expirando
 */
async function getUsersWithExpiringTrial(daysRemaining) {
    const result = await pool.query(`
        SELECT id, name, email, subscription_ends_at, trial_reminder_sent
        FROM users
        WHERE subscription_status = 'trial'
          AND subscription_ends_at IS NOT NULL
          AND subscription_ends_at > NOW()
          AND subscription_ends_at <= NOW() + INTERVAL '${daysRemaining} days'
          AND (trial_reminder_sent IS NULL OR trial_reminder_sent < $1)
    `, [daysRemaining]);

    return result.rows;
}

/**
 * Busca usuarios com trial expirado
 */
async function getUsersWithExpiredTrial() {
    const result = await pool.query(`
        SELECT id, name, email, subscription_ends_at
        FROM users
        WHERE subscription_status = 'trial'
          AND subscription_ends_at IS NOT NULL
          AND subscription_ends_at < NOW()
    `);

    return result.rows;
}

/**
 * Marca lembrete de trial como enviado
 */
async function markTrialReminderSent(userId, reminderLevel) {
    await pool.query(`
        UPDATE users SET trial_reminder_sent = $1 WHERE id = $2
    `, [reminderLevel, userId]);
}

/**
 * Obtem limites do plano com defaults robustos
 */
async function getPlanLimits(plan) {
    // Defaults por plano (FREE, TRIAL, PRO)
    const planDefaults = {
        free: {
            maxClients: 1,
            maxBranches: 1,
            maxTopics: 5,
            maxComplaints: 100,
            whatsapp: false,
            webhook: false,
            customDomain: false,
            export: false,
            reports: false
        },
        trial: {
            maxClients: 10,
            maxBranches: 10,
            maxTopics: 999999,
            maxComplaints: 999999,
            whatsapp: true,
            webhook: true,
            customDomain: false,
            export: true,
            reports: true
        },
        pro: {
            maxClients: 15,
            maxBranches: 10,
            maxTopics: 999999,
            maxComplaints: 999999,
            whatsapp: true,
            webhook: true,
            customDomain: false,
            export: true,
            reports: true
        }
    };

    const defaults = planDefaults[plan] || planDefaults.free;

    // Tentar buscar configuracoes customizadas do banco
    try {
        const settings = await getAllPlatformSettings();
        const suffix = `_${plan}`;

        return {
            maxClients: parseInt(settings[`max_clients${suffix}`]) || defaults.maxClients,
            maxBranches: parseInt(settings[`max_branches${suffix}`]) || defaults.maxBranches,
            maxTopics: parseInt(settings[`max_topics${suffix}`]) || defaults.maxTopics,
            maxComplaints: parseInt(settings[`max_complaints${suffix}`]) || defaults.maxComplaints,
            whatsapp: settings[`feature_whatsapp${suffix}`] === 'true' || defaults.whatsapp,
            webhook: settings[`feature_webhook${suffix}`] === 'true' || defaults.webhook,
            customDomain: settings[`feature_custom_domain${suffix}`] === 'true' || defaults.customDomain,
            export: settings[`feature_export${suffix}`] === 'true' || defaults.export,
            reports: settings[`feature_reports${suffix}`] === 'true' || defaults.reports
        };
    } catch (error) {
        // Se falhar, retorna defaults
        return {
            maxClients: defaults.maxClients,
            maxBranches: defaults.maxBranches,
            maxTopics: defaults.maxTopics,
            maxComplaints: defaults.maxComplaints,
            whatsapp: defaults.whatsapp,
            webhook: defaults.webhook,
            customDomain: defaults.customDomain,
            export: defaults.export,
            reports: defaults.reports
        };
    }
}

/**
 * Verifica se usuario atingiu limite
 */
async function checkUserLimit(userId, limitType) {
    const subInfo = await getSubscriptionInfo(userId);
    if (!subInfo) return { allowed: false, reason: 'Usuario nao encontrado' };

    const limits = await getPlanLimits(subInfo.plan);
    let currentCount = 0;
    let maxLimit = 0;

    switch (limitType) {
        case 'clients':
            const clientsResult = await pool.query(
                'SELECT COUNT(*) FROM clients WHERE user_id = $1', [userId]
            );
            currentCount = parseInt(clientsResult.rows[0].count);
            maxLimit = limits.maxClients;
            break;

        case 'branches':
            const branchesResult = await pool.query(`
                SELECT COUNT(*) FROM client_branches cb
                JOIN clients c ON cb.client_id = c.id
                WHERE c.user_id = $1
            `, [userId]);
            currentCount = parseInt(branchesResult.rows[0].count);
            maxLimit = limits.maxBranches;
            break;

        case 'topics':
            const topicsResult = await pool.query(`
                SELECT COUNT(*) FROM complaint_topics ct
                JOIN clients c ON ct.client_id = c.id
                WHERE c.user_id = $1
            `, [userId]);
            currentCount = parseInt(topicsResult.rows[0].count);
            maxLimit = limits.maxTopics;
            break;

        default:
            return { allowed: true };
    }

    return {
        allowed: maxLimit === -1 || currentCount < maxLimit,
        current: currentCount,
        limit: maxLimit,
        remaining: maxLimit === -1 ? 'unlimited' : Math.max(0, maxLimit - currentCount)
    };
}

/**
 * Desativa/ativa todos os clientes de um usuario
 * Usado quando subscription expira/cancela ou e reativada
 */
async function setClientsActiveByUserId(userId, active) {
    await pool.query(
        'UPDATE clients SET active = $1 WHERE user_id = $2',
        [active ? 1 : 0, userId]
    );
}

/**
 * Atualiza status de todas as instancias WhatsApp de um usuario
 * Usado para marcar como 'disconnected' quando subscription expira
 */
async function updateWhatsAppInstancesStatusByUser(userId, status) {
    await pool.query(
        'UPDATE whatsapp_instances SET status = $1, updated_at = NOW() WHERE user_id = $2',
        [status, userId]
    );
}

module.exports = {
    init,
    NICHE_TEMPLATES,
    createUser,
    getUserByEmail,
    getUserById,
    getUserByIdWithStatus,  // Nova funcao otimizada para auth
    updateUser,
    updateUserPassword,
    updateUserLastLogin,
    setPasswordResetToken,
    getUserByResetToken,
    clearPasswordResetToken,
    createClient,
    getClientsByUserId,
    getClientById,
    getClientBySlug,
    getClientByCustomDomain,
    getClientDataForReview,
    findSlugsByPrefix,
    updateClient,
    deleteClient,
    getBranchesByClientId,
    getBranchById,
    createBranch,
    updateBranch,
    deleteBranch,
    getTopicsByClientId,
    getAllTopicsByClientId,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic,
    resetTopicsToNiche,
    createComplaint,
    getComplaintsByClientId,
    countComplaintsByClientId,
    getComplaintById,
    updateComplaintStatus,
    getStats,
    getAllComplaintsByUserId,
    countComplaintsByUserId,  // Nova funcao para paginacao
    getIntegrationsByUserId,
    updateIntegrations,
    // Admin functions
    getAdminByEmail,
    getAdminById,
    createAdmin,
    updateAdminLastLogin,
    createAdminLog,
    getAdminLogs,
    getPlatformSetting,
    getAllPlatformSettings,
    updatePlatformSetting,
    getAllUsers,
    getTotalUsersCount,
    getUserByIdAdmin,
    updateUserStatus,
    deleteUserAdmin,
    getAdminStats,
    getUserFullData,
    // Feedback functions
    createFeedback,
    getUserLastFeedbackDate,
    getAllFeedbacks,
    getFeedbackById,
    updateFeedbackStatus,
    getFeedbackStats,
    getTotalFeedbacksCount,
    // Database stats
    getDatabaseStats,
    cleanupOldData,
    // WhatsApp Instances functions
    createWhatsAppInstance,
    getWhatsAppInstancesByUser,
    getWhatsAppInstanceById,
    getWhatsAppInstanceByClient,
    updateWhatsAppInstance,
    deleteWhatsAppInstance,
    countUserInstances,
    hasUserFreeInstance,
    getClientsWithoutInstance,
    updateUserStripeCustomerId,
    getUserWithSubscription,
    // Subscription management functions
    logSubscriptionEvent,
    getUserSubscriptionData,
    getSubscriptionInfo,
    updateSubscriptionStatus,
    startUserTrial,
    getUsersWithExpiringTrial,
    getUsersWithExpiredTrial,
    markTrialReminderSent,
    getPlanLimits,
    checkUserLimit,
    // Subscription deactivation functions
    setClientsActiveByUserId,
    updateWhatsAppInstancesStatusByUser,
    // Cache service export
    cache,
    // Pool export para queries diretas quando necessario
    pool
};
