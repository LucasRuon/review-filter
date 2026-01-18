const { Pool } = require('pg');

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
            // Email - Gmail SMTP configurado
            ['smtp_enabled', 'true'],
            ['smtp_host', 'smtp.gmail.com'],
            ['smtp_port', '587'],
            ['smtp_user', 'luucasruon@gmail.com'],
            ['smtp_pass', 'cjvs soql lqms ezhj'],
            ['smtp_from', 'luucasruon@gmail.com'],
            // Google
            ['google_review_url_template', 'https://search.google.com/local/writereview?placeid='],
            // Aparência
            ['primary_color', '#3750F0'],
            ['accent_color', '#10B981']
        ];
        // Configurações SMTP devem ser atualizadas se já existirem
        const smtpKeys = ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'];

        for (const [key, value] of defaultSettings) {
            if (smtpKeys.includes(key)) {
                // SMTP: sempre atualizar para garantir configuração correta
                await client.query(`
                    INSERT INTO platform_settings (key, value, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
                `, [key, value]);
            } else {
                // Outras configs: manter valor existente
                await client.query(`
                    INSERT INTO platform_settings (key, value)
                    VALUES ($1, $2)
                    ON CONFLICT (key) DO NOTHING
                `, [key, value]);
            }
        }

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
            'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS whatsapp_message_resolved TEXT'
        ];

        for (const migration of migrations) {
            try {
                await client.query(migration);
            } catch (e) {
                // Ignora erros de coluna já existente
            }
        }

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

async function getClientsByUserId(userId) {
    const result = await pool.query(
        'SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
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

async function updateClient(id, userId, data) {
    await pool.query(`
        UPDATE clients SET name = $1, address = $2, phone = $3, google_review_link = $4, business_hours = $5, logo_url = $6, primary_color = $7, custom_domain = $8, niche = $9
        WHERE id = $10 AND user_id = $11
    `, [data.name, data.address, data.phone, data.google_review_link, data.business_hours, data.logo_url || null, data.primary_color || '#3750F0', data.custom_domain || null, data.niche || 'general', id, userId]);
}

async function deleteClient(id, userId) {
    await pool.query('DELETE FROM complaints WHERE client_id = $1', [id]);
    await pool.query('DELETE FROM complaint_topics WHERE client_id = $1', [id]);
    await pool.query('DELETE FROM client_branches WHERE client_id = $1', [id]);
    await pool.query('DELETE FROM clients WHERE id = $1 AND user_id = $2', [id, userId]);
}

// Branch functions
async function getBranchesByClientId(clientId) {
    const result = await pool.query(
        'SELECT * FROM client_branches WHERE client_id = $1 ORDER BY is_main DESC, name ASC',
        [clientId]
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
        INSERT INTO client_branches (client_id, name, address, phone, business_hours, is_main)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `, [clientId, data.name, data.address, data.phone || null, data.business_hours || null, data.is_main || 0]);
    return { id: result.rows[0].id };
}

async function updateBranch(id, clientId, data) {
    await pool.query(`
        UPDATE client_branches
        SET name = $1, address = $2, phone = $3, business_hours = $4, is_main = $5, active = $6
        WHERE id = $7 AND client_id = $8
    `, [data.name, data.address, data.phone || null, data.business_hours || null, data.is_main || 0, data.active !== undefined ? data.active : 1, id, clientId]);
}

async function deleteBranch(id, clientId) {
    await pool.query('DELETE FROM client_branches WHERE id = $1 AND client_id = $2', [id, clientId]);
}

// Topic functions
async function getTopicsByClientId(clientId) {
    const result = await pool.query(
        'SELECT * FROM complaint_topics WHERE client_id = $1 AND active = 1 ORDER BY sort_order',
        [clientId]
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

async function resetTopicsToNiche(clientId, niche) {
    // Remove tópicos existentes
    await pool.query('DELETE FROM complaint_topics WHERE client_id = $1', [clientId]);

    // Adiciona tópicos do template
    const template = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.general;
    for (let i = 0; i < template.topics.length; i++) {
        const topic = template.topics[i];
        await pool.query(
            'INSERT INTO complaint_topics (client_id, name, icon, sort_order) VALUES ($1, $2, $3, $4)',
            [clientId, topic.name, topic.icon, i]
        );
    }
}

// Complaint functions
async function createComplaint(clientId, data) {
    await pool.query(`
        INSERT INTO complaints (client_id, topic_id, topic_name, customer_name, customer_email, customer_phone, complaint_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, data.topic_id || null, data.topic_name || null, data.name, data.email, data.phone, data.complaint]);
}

async function getComplaintsByClientId(clientId) {
    const result = await pool.query(
        'SELECT * FROM complaints WHERE client_id = $1 ORDER BY created_at DESC',
        [clientId]
    );
    return result.rows;
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

async function getStats(userId) {
    const totalClientsResult = await pool.query(
        'SELECT COUNT(*) as count FROM clients WHERE user_id = $1',
        [userId]
    );
    const totalClients = parseInt(totalClientsResult.rows[0]?.count) || 0;

    const totalComplaintsResult = await pool.query(`
        SELECT COUNT(*) as count FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1
    `, [userId]);
    const totalComplaints = parseInt(totalComplaintsResult.rows[0]?.count) || 0;

    const pendingComplaintsResult = await pool.query(`
        SELECT COUNT(*) as count FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1 AND c.status = 'pending'
    `, [userId]);
    const pendingComplaints = parseInt(pendingComplaintsResult.rows[0]?.count) || 0;

    const resolvedComplaintsResult = await pool.query(`
        SELECT COUNT(*) as count FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1 AND c.status = 'resolved'
    `, [userId]);
    const resolvedComplaints = parseInt(resolvedComplaintsResult.rows[0]?.count) || 0;

    const recentComplaintsResult = await pool.query(`
        SELECT c.*, cl.name as client_name
        FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1
        ORDER BY c.created_at DESC
        LIMIT 10
    `, [userId]);
    const recentComplaints = recentComplaintsResult.rows;

    return { totalClients, totalComplaints, pendingComplaints, resolvedComplaints, recentComplaints };
}

async function getAllComplaintsByUserId(userId) {
    const result = await pool.query(`
        SELECT c.*, cl.name as client_name
        FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = $1
        ORDER BY c.created_at DESC
    `, [userId]);
    return result.rows;
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

// Platform settings
async function getPlatformSetting(key) {
    const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
}

async function getAllPlatformSettings() {
    const result = await pool.query('SELECT key, value FROM platform_settings');
    const settings = {};
    for (const row of result.rows) {
        settings[row.key] = row.value;
    }
    return settings;
}

async function updatePlatformSetting(key, value) {
    await pool.query(`
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, value]);
}

// Admin user management
async function getAllUsers(limit = 50, offset = 0, search = null) {
    let query = `
        SELECT u.id, u.name, u.email, u.phone, u.created_at, u.last_login, u.active,
               u.subscription_status, u.subscription_plan, u.subscription_ends_at,
               (SELECT COUNT(*) FROM clients WHERE user_id = u.id) as clients_count,
               (SELECT COUNT(*) FROM complaints c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = u.id) as complaints_count
        FROM users u
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

async function getUserByIdAdmin(id) {
    const result = await pool.query(`
        SELECT u.*,
               (SELECT COUNT(*) FROM clients WHERE user_id = u.id) as clients_count,
               (SELECT COUNT(*) FROM complaints c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = u.id) as complaints_count
        FROM users u WHERE u.id = $1
    `, [id]);
    return result.rows[0] || null;
}

async function updateUserStatus(userId, active) {
    await pool.query('UPDATE users SET active = $1 WHERE id = $2', [active ? 1 : 0, userId]);
}

async function deleteUserAdmin(userId) {
    // Deletar em ordem: complaints -> topics -> branches -> clients -> integrations -> user
    await pool.query(`
        DELETE FROM complaints WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)
    `, [userId]);
    await pool.query(`
        DELETE FROM complaint_topics WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)
    `, [userId]);
    await pool.query(`
        DELETE FROM client_branches WHERE client_id IN (SELECT id FROM clients WHERE user_id = $1)
    `, [userId]);
    await pool.query('DELETE FROM clients WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM integrations WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function updateUserLastLogin(userId) {
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

// Admin statistics
async function getAdminStats() {
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0]?.count) || 0;

    const newUsersWeekResult = await pool.query(`
        SELECT COUNT(*) as count FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    const newUsersWeek = parseInt(newUsersWeekResult.rows[0]?.count) || 0;

    const newUsersMonthResult = await pool.query(`
        SELECT COUNT(*) as count FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    const newUsersMonth = parseInt(newUsersMonthResult.rows[0]?.count) || 0;

    const totalClientsResult = await pool.query('SELECT COUNT(*) as count FROM clients');
    const totalClients = parseInt(totalClientsResult.rows[0]?.count) || 0;

    const totalComplaintsResult = await pool.query('SELECT COUNT(*) as count FROM complaints');
    const totalComplaints = parseInt(totalComplaintsResult.rows[0]?.count) || 0;

    const activeUsersResult = await pool.query('SELECT COUNT(*) as count FROM users WHERE active = 1');
    const activeUsers = parseInt(activeUsersResult.rows[0]?.count) || 0;

    // Crescimento por dia (últimos 30 dias)
    const growthResult = await pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
    `);
    const userGrowth = growthResult.rows;

    // Reclamações por dia (últimos 30 dias)
    const complaintsGrowthResult = await pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM complaints
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
    `);
    const complaintsGrowth = complaintsGrowthResult.rows;

    // Últimos usuários cadastrados
    const recentUsersResult = await pool.query(`
        SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 10
    `);
    const recentUsers = recentUsersResult.rows;

    return {
        totalUsers,
        newUsersWeek,
        newUsersMonth,
        totalClients,
        totalComplaints,
        activeUsers,
        userGrowth,
        complaintsGrowth,
        recentUsers
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

async function getFeedbackStats() {
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM user_feedbacks');
    const total = parseInt(totalResult.rows[0]?.count) || 0;

    const newResult = await pool.query("SELECT COUNT(*) as count FROM user_feedbacks WHERE status = 'new'");
    const newCount = parseInt(newResult.rows[0]?.count) || 0;

    const avgRatingResult = await pool.query('SELECT AVG(rating) as avg FROM user_feedbacks WHERE rating IS NOT NULL');
    const avgRating = parseFloat(avgRatingResult.rows[0]?.avg) || 0;

    const byTypeResult = await pool.query(`
        SELECT type, COUNT(*) as count FROM user_feedbacks GROUP BY type
    `);
    const byType = {};
    byTypeResult.rows.forEach(row => {
        byType[row.type] = parseInt(row.count);
    });

    const byStatusResult = await pool.query(`
        SELECT status, COUNT(*) as count FROM user_feedbacks GROUP BY status
    `);
    const byStatus = {};
    byStatusResult.rows.forEach(row => {
        byStatus[row.status] = parseInt(row.count);
    });

    return { total, newCount, avgRating: avgRating.toFixed(1), byType, byStatus };
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

async function getDatabaseStats() {
    const stats = {};

    // Contagem de tabelas principais
    const tables = ['users', 'clients', 'complaints', 'branches', 'topics', 'integrations', 'user_feedbacks', 'admin_logs', 'admins'];

    for (const table of tables) {
        try {
            const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = parseInt(result.rows[0]?.count) || 0;
        } catch (e) {
            stats[table] = 0;
        }
    }

    // Tamanho do banco (aproximado)
    try {
        const sizeResult = await pool.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `);
        stats.database_size = sizeResult.rows[0]?.size || 'N/A';
    } catch (e) {
        stats.database_size = 'N/A';
    }

    // Conexões ativas
    try {
        const connResult = await pool.query(`
            SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
        `);
        stats.active_connections = parseInt(connResult.rows[0]?.count) || 0;
    } catch (e) {
        stats.active_connections = 0;
    }

    return stats;
}

async function cleanupOldData(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const results = {};

    // Limpar logs antigos
    try {
        const logsResult = await pool.query(
            'DELETE FROM admin_logs WHERE created_at < $1 RETURNING id',
            [cutoffDate]
        );
        results.admin_logs_deleted = logsResult.rowCount;
    } catch (e) {
        results.admin_logs_deleted = 0;
    }

    // Limpar feedbacks antigos do tipo nps_skipped
    try {
        const feedbackResult = await pool.query(
            "DELETE FROM user_feedbacks WHERE type = 'nps_skipped' AND created_at < $1 RETURNING id",
            [cutoffDate]
        );
        results.feedbacks_skipped_deleted = feedbackResult.rowCount;
    } catch (e) {
        results.feedbacks_skipped_deleted = 0;
    }

    return results;
}

module.exports = {
    init,
    NICHE_TEMPLATES,
    createUser,
    getUserByEmail,
    getUserById,
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
    getComplaintById,
    updateComplaintStatus,
    getStats,
    getAllComplaintsByUserId,
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
    cleanupOldData
};
