# Feature: Integração Stripe com Trial de 14 Dias

## Visão Geral

Implementação completa de sistema de pagamentos usando Stripe, com período de teste gratuito de 14 dias e bloqueio automático de funcionalidades após expiração do trial sem pagamento.

---

## 1. Estado Atual do Sistema

### 1.1 Campos Já Existentes na Tabela `users`

```sql
subscription_status TEXT DEFAULT 'free'    -- free/trial/active/paused/canceled
subscription_plan TEXT DEFAULT 'free'      -- free/pro/enterprise
stripe_customer_id TEXT                    -- ID do cliente no Stripe
stripe_subscription_id TEXT                -- ID da assinatura no Stripe
subscription_ends_at TIMESTAMP             -- Data de expiração
```

### 1.2 Configurações de Plataforma Existentes (`platform_settings`)

```sql
['trial_days', '14']
['default_plan', 'free']
['max_clients_free', '1']
['max_clients_pro', '10']
['max_branches_per_client', '10']
['max_topics_per_client', '20']
['max_complaints_per_client', '1000']
```

### 1.3 Estrutura de Autenticação Existente

- **Middleware:** `/middleware/auth.js` - JWT com cache de 60s
- **Rotas:** `/routes/auth.js` - Login, registro, perfil
- **Serviço de Email:** `/services/email-service.js` - Resend API + SMTP

---

## 2. Arquitetura da Solução

### 2.1 Fluxo de Assinatura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DO USUÁRIO                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. REGISTRO                                                                 │
│     ├── Usuário se cadastra                                                 │
│     ├── subscription_status = 'trial'                                       │
│     ├── subscription_ends_at = NOW() + 14 dias                              │
│     └── Cria Stripe Customer (stripe_customer_id)                           │
│                                                                              │
│  2. PERÍODO TRIAL (14 dias)                                                 │
│     ├── Acesso completo às funcionalidades PRO                              │
│     ├── Banner de aviso: "X dias restantes no trial"                        │
│     └── CTAs para upgrade                                                   │
│                                                                              │
│  3. EXPIRAÇÃO DO TRIAL                                                      │
│     ├── subscription_status = 'expired'                                     │
│     ├── Bloqueio de funcionalidades                                         │
│     ├── Apenas visualização permitida                                       │
│     └── Redirecionamento para página de pagamento                           │
│                                                                              │
│  4. PAGAMENTO                                                                │
│     ├── Stripe Checkout Session                                             │
│     ├── Webhook processa payment_intent.succeeded                           │
│     ├── subscription_status = 'active'                                      │
│     └── Acesso liberado                                                     │
│                                                                              │
│  5. CANCELAMENTO                                                             │
│     ├── Webhook: customer.subscription.deleted                              │
│     ├── subscription_status = 'canceled'                                    │
│     ├── subscription_ends_at = current_period_end                           │
│     └── Acesso até fim do período pago                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estados de Assinatura

| Status | Descrição | Acesso |
|--------|-----------|--------|
| `trial` | Em período de teste | Completo (PRO) |
| `active` | Assinatura ativa | Completo (conforme plano) |
| `expired` | Trial expirado sem pagamento | Bloqueado |
| `past_due` | Pagamento atrasado | Limitado (grace period 7 dias) |
| `canceled` | Cancelado pelo usuário | Até fim do período |
| `free` | Plano gratuito | Limitado |

---

## 3. Alterações no Banco de Dados

### 3.1 Novos Campos na Tabela `users`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminder_sent INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
```

### 3.2 Nova Tabela: `subscription_history`

```sql
CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    -- subscription_created, subscription_updated, subscription_canceled,
    -- payment_succeeded, payment_failed, trial_started, trial_ended,
    -- plan_changed, invoice_paid, invoice_failed
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

CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_event_type ON subscription_history(event_type);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at);
```

### 3.3 Nova Tabela: `invoices`

```sql
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'brl',
    status TEXT NOT NULL,
    -- draft, open, paid, uncollectible, void
    description TEXT,
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
```

### 3.4 Novas Configurações de Plataforma

```sql
INSERT INTO platform_settings (key, value) VALUES
    ('stripe_publishable_key', ''),
    ('stripe_secret_key', ''),
    ('stripe_webhook_secret', ''),
    ('stripe_price_id_pro_monthly', ''),
    ('stripe_price_id_pro_yearly', ''),
    ('stripe_price_id_enterprise_monthly', ''),
    ('stripe_price_id_enterprise_yearly', ''),
    ('trial_days', '14'),
    ('trial_reminder_days', '3'),
    ('grace_period_days', '7'),
    ('enable_yearly_discount', 'true'),
    ('yearly_discount_percent', '20'),
    ('pro_monthly_price_brl', '9700'),
    ('pro_yearly_price_brl', '93120'),
    ('enterprise_monthly_price_brl', '29700'),
    ('enterprise_yearly_price_brl', '285120')
ON CONFLICT (key) DO NOTHING;
```

---

## 4. Novos Arquivos a Criar

### 4.1 Estrutura de Arquivos

```
/routes/
    └── stripe.js                    # Rotas de pagamento e webhooks

/services/
    └── stripe-service.js            # Lógica de integração Stripe

/middleware/
    └── subscription.js              # Middleware de verificação de assinatura

/views/
    ├── pricing.html                 # Página de planos e preços
    ├── checkout.html                # Página de checkout
    ├── billing.html                 # Gestão de assinatura/faturas
    └── trial-expired.html           # Página de trial expirado

/views/spa/
    └── billing.html                 # Componente SPA de billing

/views/components/
    └── trial-banner.html            # Banner de trial
```

---

## 5. Especificação: `/services/stripe-service.js`

```javascript
/**
 * Stripe Service
 *
 * Responsabilidades:
 * - Criar/gerenciar clientes Stripe
 * - Criar sessões de checkout
 * - Gerenciar assinaturas
 * - Processar webhooks
 * - Sincronizar status
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database');
const emailService = require('./email-service');
const logger = require('../logger');

class StripeService {

    // ==========================================
    // GESTÃO DE CLIENTES
    // ==========================================

    /**
     * Cria ou retorna cliente Stripe existente
     * @param {number} userId
     * @returns {Promise<string>} stripe_customer_id
     */
    async getOrCreateCustomer(userId) {}

    /**
     * Atualiza dados do cliente no Stripe
     * @param {number} userId
     * @param {object} data - { email, name, phone }
     */
    async updateCustomer(userId, data) {}

    // ==========================================
    // CHECKOUT & ASSINATURAS
    // ==========================================

    /**
     * Cria sessão de checkout para assinatura
     * @param {number} userId
     * @param {string} priceId - Stripe Price ID
     * @param {string} successUrl
     * @param {string} cancelUrl
     * @returns {Promise<object>} { sessionId, url }
     */
    async createCheckoutSession(userId, priceId, successUrl, cancelUrl) {}

    /**
     * Cria portal de billing para gestão pelo cliente
     * @param {number} userId
     * @param {string} returnUrl
     * @returns {Promise<string>} portal URL
     */
    async createBillingPortalSession(userId, returnUrl) {}

    /**
     * Cancela assinatura
     * @param {number} userId
     * @param {boolean} immediate - Se true, cancela imediatamente
     * @param {string} reason - Motivo do cancelamento
     */
    async cancelSubscription(userId, immediate = false, reason = null) {}

    /**
     * Reativa assinatura cancelada (se ainda no período)
     * @param {number} userId
     */
    async reactivateSubscription(userId) {}

    /**
     * Altera plano de assinatura
     * @param {number} userId
     * @param {string} newPriceId
     * @param {boolean} prorate - Se deve calcular pro-rata
     */
    async changePlan(userId, newPriceId, prorate = true) {}

    // ==========================================
    // TRIAL
    // ==========================================

    /**
     * Inicia período de trial para usuário
     * @param {number} userId
     * @param {number} days - Dias de trial (default: 14)
     */
    async startTrial(userId, days = 14) {}

    /**
     * Verifica se trial expirou
     * @param {number} userId
     * @returns {Promise<boolean>}
     */
    async isTrialExpired(userId) {}

    /**
     * Retorna dias restantes do trial
     * @param {number} userId
     * @returns {Promise<number>} Dias restantes (-1 se não em trial)
     */
    async getTrialDaysRemaining(userId) {}

    // ==========================================
    // WEBHOOKS
    // ==========================================

    /**
     * Processa webhook do Stripe
     * @param {string} payload - Raw body
     * @param {string} signature - Stripe signature header
     */
    async handleWebhook(payload, signature) {}

    /**
     * Handlers específicos por evento
     */
    async handleCheckoutCompleted(session) {}
    async handleSubscriptionCreated(subscription) {}
    async handleSubscriptionUpdated(subscription) {}
    async handleSubscriptionDeleted(subscription) {}
    async handleInvoicePaid(invoice) {}
    async handleInvoicePaymentFailed(invoice) {}
    async handleCustomerUpdated(customer) {}

    // ==========================================
    // SINCRONIZAÇÃO
    // ==========================================

    /**
     * Sincroniza status da assinatura com Stripe
     * @param {number} userId
     */
    async syncSubscriptionStatus(userId) {}

    /**
     * Job: Verifica trials expirando e envia lembretes
     */
    async processTrialReminders() {}

    /**
     * Job: Processa trials expirados
     */
    async processExpiredTrials() {}

    // ==========================================
    // CONSULTAS
    // ==========================================

    /**
     * Retorna informações de assinatura do usuário
     * @param {number} userId
     */
    async getSubscriptionInfo(userId) {}

    /**
     * Retorna histórico de faturas
     * @param {number} userId
     */
    async getInvoices(userId) {}

    /**
     * Retorna próxima fatura prevista
     * @param {number} userId
     */
    async getUpcomingInvoice(userId) {}
}

module.exports = new StripeService();
```

---

## 6. Especificação: `/middleware/subscription.js`

```javascript
/**
 * Subscription Middleware
 *
 * Verifica status da assinatura e bloqueia acesso conforme necessário
 */

const db = require('../database');
const cacheService = require('../services/cache-service');

/**
 * Verifica se usuário tem acesso às funcionalidades
 * Níveis de verificação:
 * - 'any': Qualquer status ativo (trial, active)
 * - 'paid': Apenas assinaturas pagas (active)
 * - 'pro': Plano PRO ou superior
 * - 'enterprise': Apenas plano Enterprise
 */
function requireSubscription(level = 'any') {
    return async (req, res, next) => {
        // Implementação
    };
}

/**
 * Middleware que adiciona informações de assinatura ao request
 * Não bloqueia, apenas enriquece req.subscription
 */
async function loadSubscriptionInfo(req, res, next) {
    // Adiciona: req.subscription = {
    //     status, plan, isTrialing, trialDaysRemaining,
    //     isExpired, canAccessFeature(feature), limits
    // }
}

/**
 * Verifica limite específico do plano
 * @param {string} limitKey - 'clients', 'branches', 'topics', etc.
 */
function checkPlanLimit(limitKey) {
    return async (req, res, next) => {
        // Implementação
    };
}

module.exports = {
    requireSubscription,
    loadSubscriptionInfo,
    checkPlanLimit
};
```

---

## 7. Especificação: `/routes/stripe.js`

```javascript
/**
 * Stripe Routes
 *
 * Endpoints para checkout, webhooks e gestão de assinatura
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripe-service');
const { authMiddleware } = require('../middleware/auth');

// ==========================================
// CHECKOUT
// ==========================================

/**
 * POST /api/stripe/create-checkout-session
 * Cria sessão de checkout para upgrade
 * Body: { priceId, plan }
 * Returns: { sessionId, url }
 */
router.post('/create-checkout-session', authMiddleware, async (req, res) => {});

/**
 * GET /api/stripe/checkout-success
 * Callback de sucesso do checkout
 * Query: { session_id }
 */
router.get('/checkout-success', authMiddleware, async (req, res) => {});

// ==========================================
// BILLING PORTAL
// ==========================================

/**
 * POST /api/stripe/create-portal-session
 * Cria sessão do portal de billing
 * Returns: { url }
 */
router.post('/create-portal-session', authMiddleware, async (req, res) => {});

// ==========================================
// ASSINATURA
// ==========================================

/**
 * GET /api/stripe/subscription
 * Retorna informações da assinatura atual
 */
router.get('/subscription', authMiddleware, async (req, res) => {});

/**
 * POST /api/stripe/cancel
 * Cancela assinatura
 * Body: { immediate?, reason? }
 */
router.post('/cancel', authMiddleware, async (req, res) => {});

/**
 * POST /api/stripe/reactivate
 * Reativa assinatura cancelada
 */
router.post('/reactivate', authMiddleware, async (req, res) => {});

/**
 * POST /api/stripe/change-plan
 * Altera plano de assinatura
 * Body: { newPriceId }
 */
router.post('/change-plan', authMiddleware, async (req, res) => {});

// ==========================================
// FATURAS
// ==========================================

/**
 * GET /api/stripe/invoices
 * Lista faturas do usuário
 */
router.get('/invoices', authMiddleware, async (req, res) => {});

/**
 * GET /api/stripe/upcoming-invoice
 * Retorna próxima fatura
 */
router.get('/upcoming-invoice', authMiddleware, async (req, res) => {});

// ==========================================
// PLANOS
// ==========================================

/**
 * GET /api/stripe/plans
 * Lista planos disponíveis com preços
 */
router.get('/plans', async (req, res) => {});

// ==========================================
// WEBHOOKS
// ==========================================

/**
 * POST /api/stripe/webhook
 * Webhook do Stripe (sem auth, usa signature)
 * Headers: stripe-signature
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {});

module.exports = router;
```

---

## 8. Limites por Plano

### 8.1 Tabela de Limites

| Recurso | Free | Trial | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Clientes | 1 | 10 | 10 | Ilimitado |
| Filiais por cliente | 1 | 10 | 10 | Ilimitado |
| Tópicos por cliente | 5 | 20 | 20 | Ilimitado |
| Reclamações armazenadas | 100 | 1000 | 1000 | Ilimitado |
| Integração WhatsApp | ❌ | ✅ | ✅ | ✅ |
| Webhook externo | ❌ | ✅ | ✅ | ✅ |
| Domínio personalizado | ❌ | ❌ | ❌ | ✅ |
| Suporte prioritário | ❌ | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ❌ | ✅ |
| Relatórios avançados | ❌ | ✅ | ✅ | ✅ |
| Exportação de dados | ❌ | ✅ | ✅ | ✅ |

### 8.2 Configuração de Limites no Banco

```sql
-- Atualizar platform_settings
UPDATE platform_settings SET value = '1' WHERE key = 'max_clients_free';
UPDATE platform_settings SET value = '10' WHERE key = 'max_clients_pro';
INSERT INTO platform_settings (key, value) VALUES ('max_clients_enterprise', '-1'); -- -1 = ilimitado

INSERT INTO platform_settings (key, value) VALUES
    ('max_branches_free', '1'),
    ('max_branches_pro', '10'),
    ('max_branches_enterprise', '-1'),
    ('max_topics_free', '5'),
    ('max_topics_pro', '20'),
    ('max_topics_enterprise', '-1'),
    ('max_complaints_free', '100'),
    ('max_complaints_pro', '1000'),
    ('max_complaints_enterprise', '-1'),
    ('feature_whatsapp_free', 'false'),
    ('feature_whatsapp_pro', 'true'),
    ('feature_whatsapp_enterprise', 'true'),
    ('feature_webhook_free', 'false'),
    ('feature_webhook_pro', 'true'),
    ('feature_webhook_enterprise', 'true'),
    ('feature_custom_domain_free', 'false'),
    ('feature_custom_domain_pro', 'false'),
    ('feature_custom_domain_enterprise', 'true'),
    ('feature_export_free', 'false'),
    ('feature_export_pro', 'true'),
    ('feature_export_enterprise', 'true'),
    ('feature_reports_free', 'false'),
    ('feature_reports_pro', 'true'),
    ('feature_reports_enterprise', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## 9. Lógica de Bloqueio de Funcionalidades

### 9.1 Funcionalidades Bloqueadas Após Trial Expirado

Quando `subscription_status = 'expired'`:

| Funcionalidade | Comportamento |
|----------------|---------------|
| Dashboard | Visualização apenas, banner de upgrade |
| Criar cliente | Bloqueado com modal de upgrade |
| Editar cliente | Bloqueado |
| Criar tópico | Bloqueado |
| Criar filial | Bloqueado |
| Ver reclamações | Visualização limitada (últimas 10) |
| Alterar status reclamação | Bloqueado |
| Integrações | Bloqueado |
| Configurações | Permitido (para upgrade) |
| Perfil | Permitido |
| Página de review pública | Funciona (para não prejudicar clientes) |

### 9.2 Implementação do Bloqueio

```javascript
// Middleware de verificação em cada rota protegida
// /routes/clients.js

router.post('/', authMiddleware, requireSubscription('any'), async (req, res) => {
    // Criar cliente - só se subscription ativa
});

router.put('/:id', authMiddleware, requireSubscription('any'), async (req, res) => {
    // Editar cliente - só se subscription ativa
});

// Algumas rotas permitem leitura mesmo com trial expirado
router.get('/', authMiddleware, loadSubscriptionInfo, async (req, res) => {
    // Lista clientes - sempre permite, mas com avisos
});
```

### 9.3 Resposta de API para Bloqueio

```json
{
    "error": true,
    "code": "SUBSCRIPTION_REQUIRED",
    "message": "Seu período de teste expirou. Faça upgrade para continuar.",
    "subscription": {
        "status": "expired",
        "trialEndedAt": "2024-01-15T00:00:00Z",
        "daysOverdue": 5
    },
    "upgrade_url": "/pricing"
}
```

---

## 10. Modificações em Arquivos Existentes

### 10.1 `/routes/auth.js` - Registro

```javascript
// No registro, iniciar trial automaticamente
router.post('/register', async (req, res) => {
    // ... validações existentes ...

    // Criar usuário com trial
    const trialDays = await db.getSetting('trial_days') || 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + parseInt(trialDays));

    const result = await db.pool.query(`
        INSERT INTO users (
            name, email, password_hash, phone,
            subscription_status, subscription_plan,
            trial_started_at, subscription_ends_at
        ) VALUES ($1, $2, $3, $4, 'trial', 'pro', NOW(), $5)
        RETURNING id
    `, [name, normalizedEmail, hashedPassword, phone, trialEndsAt]);

    // Criar cliente Stripe
    const stripeService = require('../services/stripe-service');
    await stripeService.getOrCreateCustomer(result.rows[0].id);

    // Log do evento
    await db.logSubscriptionEvent(result.rows[0].id, 'trial_started', {
        trial_days: trialDays,
        ends_at: trialEndsAt
    });

    // ... resto do código ...
});
```

### 10.2 `/middleware/auth.js` - Adicionar Info de Subscription

```javascript
// Após verificar usuário, adicionar info de subscription
const authMiddleware = async (req, res, next) => {
    // ... código existente de verificação JWT ...

    // Adicionar informações de assinatura
    const subscriptionInfo = await getSubscriptionInfo(req.userId);
    req.subscription = subscriptionInfo;

    // Verificar se trial expirou e atualizar status
    if (subscriptionInfo.status === 'trial' && subscriptionInfo.isExpired) {
        await db.pool.query(`
            UPDATE users SET subscription_status = 'expired'
            WHERE id = $1
        `, [req.userId]);
        req.subscription.status = 'expired';
    }

    next();
};
```

### 10.3 `/server.js` - Registrar Rotas Stripe

```javascript
// Adicionar ao server.js
const stripeRoutes = require('./routes/stripe');

// IMPORTANTE: Webhook deve vir ANTES do express.json() middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Demais rotas Stripe
app.use('/api/stripe', stripeRoutes);

// Adicionar rotas de views
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'views', 'pricing.html')));
app.get('/billing', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'billing.html')));
app.get('/checkout', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'checkout.html')));
app.get('/trial-expired', (req, res) => res.sendFile(path.join(__dirname, 'views', 'trial-expired.html')));
```

### 10.4 `/database.js` - Novas Funções

```javascript
// Adicionar ao database.js

/**
 * Registra evento de subscription no histórico
 */
async function logSubscriptionEvent(userId, eventType, metadata = {}) {
    await pool.query(`
        INSERT INTO subscription_history (user_id, event_type, metadata)
        VALUES ($1, $2, $3)
    `, [userId, eventType, JSON.stringify(metadata)]);
}

/**
 * Obtém informações de subscription do usuário
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
            EXTRACT(DAY FROM (subscription_ends_at - NOW())) as days_remaining
        FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) return null;

    const user = result.rows[0];
    return {
        status: user.subscription_status,
        plan: user.subscription_plan,
        stripeCustomerId: user.stripe_customer_id,
        stripeSubscriptionId: user.stripe_subscription_id,
        endsAt: user.subscription_ends_at,
        trialStartedAt: user.trial_started_at,
        daysRemaining: Math.max(0, Math.floor(user.days_remaining || 0)),
        isTrialing: user.subscription_status === 'trial',
        isActive: ['trial', 'active'].includes(user.subscription_status),
        isExpired: user.subscription_status === 'expired' ||
                   (user.subscription_ends_at && new Date(user.subscription_ends_at) < new Date())
    };
}

/**
 * Atualiza status de subscription
 */
async function updateSubscriptionStatus(userId, status, plan = null, endsAt = null) {
    let query = `UPDATE users SET subscription_status = $1`;
    const params = [status];
    let paramIndex = 2;

    if (plan) {
        query += `, subscription_plan = $${paramIndex++}`;
        params.push(plan);
    }

    if (endsAt) {
        query += `, subscription_ends_at = $${paramIndex++}`;
        params.push(endsAt);
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(userId);

    await pool.query(query, params);
}

/**
 * Obtém limites do plano atual
 */
async function getPlanLimits(plan) {
    const settings = await getAllSettings();
    const suffix = `_${plan}`;

    return {
        maxClients: parseInt(settings[`max_clients${suffix}`]) || 1,
        maxBranches: parseInt(settings[`max_branches${suffix}`]) || 1,
        maxTopics: parseInt(settings[`max_topics${suffix}`]) || 5,
        maxComplaints: parseInt(settings[`max_complaints${suffix}`]) || 100,
        features: {
            whatsapp: settings[`feature_whatsapp${suffix}`] === 'true',
            webhook: settings[`feature_webhook${suffix}`] === 'true',
            customDomain: settings[`feature_custom_domain${suffix}`] === 'true',
            export: settings[`feature_export${suffix}`] === 'true',
            reports: settings[`feature_reports${suffix}`] === 'true'
        }
    };
}

/**
 * Verifica se usuário atingiu limite
 */
async function checkUserLimit(userId, limitType) {
    const subInfo = await getSubscriptionInfo(userId);
    const limits = await getPlanLimits(subInfo.plan);

    let currentCount = 0;

    switch (limitType) {
        case 'clients':
            const clientsResult = await pool.query(
                'SELECT COUNT(*) FROM clients WHERE user_id = $1', [userId]
            );
            currentCount = parseInt(clientsResult.rows[0].count);
            return {
                allowed: limits.maxClients === -1 || currentCount < limits.maxClients,
                current: currentCount,
                limit: limits.maxClients
            };

        // ... outros limites ...
    }
}

module.exports = {
    // ... exports existentes ...
    logSubscriptionEvent,
    getSubscriptionInfo,
    updateSubscriptionStatus,
    getPlanLimits,
    checkUserLimit
};
```

---

## 11. Variáveis de Ambiente

### 11.1 Adicionar ao `.env`

```env
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Stripe Product/Price IDs (criar no Dashboard Stripe)
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxxxxxxxxxxxx
```

### 11.2 Adicionar ao `.env.example`

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxx
```

---

## 12. Dependências NPM

### 12.1 Instalar

```bash
npm install stripe
```

### 12.2 Atualizar `package.json`

```json
{
    "dependencies": {
        "stripe": "^14.0.0"
    }
}
```

---

## 13. Webhooks do Stripe

### 13.1 Eventos a Configurar no Stripe Dashboard

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.updated
invoice.paid
invoice.payment_failed
invoice.payment_action_required
payment_intent.succeeded
payment_intent.payment_failed
```

### 13.2 Configuração do Webhook

**URL:** `https://seudominio.com/api/stripe/webhook`

**Modo:** Live (ou Test para desenvolvimento)

---

## 14. Jobs Agendados (Cron)

### 14.1 Implementar com node-cron ou similar

```javascript
// /jobs/subscription-jobs.js

const cron = require('node-cron');
const stripeService = require('../services/stripe-service');
const db = require('../database');
const emailService = require('../services/email-service');

/**
 * Executar diariamente às 9h
 * Envia lembretes de trial expirando
 */
cron.schedule('0 9 * * *', async () => {
    await stripeService.processTrialReminders();
});

/**
 * Executar a cada hora
 * Processa trials expirados
 */
cron.schedule('0 * * * *', async () => {
    await stripeService.processExpiredTrials();
});

/**
 * Executar diariamente à meia-noite
 * Sincroniza status com Stripe
 */
cron.schedule('0 0 * * *', async () => {
    // Buscar todos usuários com stripe_subscription_id
    const users = await db.pool.query(`
        SELECT id FROM users
        WHERE stripe_subscription_id IS NOT NULL
    `);

    for (const user of users.rows) {
        await stripeService.syncSubscriptionStatus(user.id);
    }
});
```

---

## 15. Fluxo de Emails

### 15.1 Emails a Implementar

| Evento | Assunto | Conteúdo |
|--------|---------|----------|
| Trial iniciado | "Bem-vindo! Seu trial de 14 dias começou" | Boas-vindas + features disponíveis |
| Trial 3 dias restantes | "Seu trial expira em 3 dias" | Lembrete + CTA upgrade |
| Trial 1 dia restante | "Último dia do seu trial!" | Urgência + CTA upgrade |
| Trial expirado | "Seu período de teste terminou" | O que foi bloqueado + CTA upgrade |
| Assinatura ativada | "Obrigado! Sua assinatura está ativa" | Confirmação + próximos passos |
| Pagamento recebido | "Recebemos seu pagamento" | Recibo + link para fatura |
| Pagamento falhou | "Problema com seu pagamento" | Instruções para atualizar cartão |
| Assinatura cancelada | "Sua assinatura foi cancelada" | Até quando tem acesso + como reativar |

### 15.2 Templates de Email

Adicionar ao `/services/email-service.js`:

```javascript
const emailTemplates = {
    trialStarted: {
        subject: 'Bem-vindo ao Opina Já! Seu trial de 14 dias começou 🎉',
        template: 'trial-started'
    },
    trialReminder3Days: {
        subject: 'Seu trial expira em 3 dias - Não perca suas funcionalidades!',
        template: 'trial-reminder-3days'
    },
    trialReminder1Day: {
        subject: '⚠️ Último dia do seu trial no Opina Já!',
        template: 'trial-reminder-1day'
    },
    trialExpired: {
        subject: 'Seu período de teste terminou',
        template: 'trial-expired'
    },
    subscriptionActivated: {
        subject: '✅ Sua assinatura está ativa!',
        template: 'subscription-activated'
    },
    paymentReceived: {
        subject: 'Recebemos seu pagamento - Opina Já',
        template: 'payment-received'
    },
    paymentFailed: {
        subject: '⚠️ Problema com seu pagamento',
        template: 'payment-failed'
    },
    subscriptionCanceled: {
        subject: 'Sua assinatura foi cancelada',
        template: 'subscription-canceled'
    }
};
```

---

## 16. Interface do Usuário

### 16.1 Banner de Trial no Dashboard

```html
<!-- Adicionar ao /views/spa/dashboard.html -->
<div id="trial-banner" class="trial-banner" style="display: none;">
    <div class="trial-banner-content">
        <span class="trial-icon">⏰</span>
        <span class="trial-text">
            <strong id="trial-days-left">14</strong> dias restantes no seu período de teste
        </span>
        <a href="/pricing" class="btn btn-upgrade">Fazer Upgrade</a>
    </div>
</div>

<style>
.trial-banner {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.trial-banner.warning {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.trial-banner.critical {
    background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
    animation: pulse 2s infinite;
}

.btn-upgrade {
    background: white;
    color: #667eea;
    padding: 8px 20px;
    border-radius: 6px;
    font-weight: 600;
    text-decoration: none;
}
</style>
```

### 16.2 Modal de Bloqueio

```html
<!-- Modal quando trial expira -->
<div id="subscription-modal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-icon">🔒</div>
        <h2>Seu período de teste expirou</h2>
        <p>Para continuar usando todas as funcionalidades do Opina Já, escolha um plano:</p>

        <div class="plan-options">
            <div class="plan-card">
                <h3>PRO</h3>
                <div class="price">R$ 97<span>/mês</span></div>
                <ul>
                    <li>✓ 10 clientes</li>
                    <li>✓ Integração WhatsApp</li>
                    <li>✓ Webhooks</li>
                    <li>✓ Relatórios</li>
                </ul>
                <button onclick="selectPlan('pro_monthly')">Escolher PRO</button>
            </div>

            <div class="plan-card featured">
                <span class="badge">Mais Popular</span>
                <h3>PRO Anual</h3>
                <div class="price">R$ 77,60<span>/mês</span></div>
                <div class="savings">Economize 20%</div>
                <ul>
                    <li>✓ Tudo do PRO</li>
                    <li>✓ 2 meses grátis</li>
                </ul>
                <button onclick="selectPlan('pro_yearly')">Escolher Anual</button>
            </div>
        </div>

        <a href="#" class="link-secondary">Continuar com plano gratuito (limitado)</a>
    </div>
</div>
```

### 16.3 Página de Preços (`/views/pricing.html`)

Criar página responsiva com:
- Comparativo de planos (Free, Pro, Enterprise)
- Toggle Mensal/Anual
- FAQ sobre billing
- Garantia de 7 dias
- Botões de checkout

---

## 17. Configuração no Stripe Dashboard

### 17.1 Criar Produtos

1. **Opina Já PRO**
   - Preço Mensal: R$ 97,00
   - Preço Anual: R$ 931,20 (R$ 77,60/mês)

2. **Opina Já Enterprise**
   - Preço Mensal: R$ 297,00
   - Preço Anual: R$ 2.851,20 (R$ 237,60/mês)

### 17.2 Configurar Customer Portal

No Stripe Dashboard > Settings > Billing > Customer portal:
- Permitir cancelamento
- Permitir alteração de plano
- Permitir atualização de pagamento
- Configurar URL de retorno

### 17.3 Configurar Webhooks

Settings > Webhooks > Add endpoint:
- URL: `https://opinaja.com.br/api/stripe/webhook`
- Eventos: (lista do item 13.1)

---

## 18. Testes

### 18.1 Cenários de Teste

1. **Registro e Trial**
   - [ ] Novo usuário recebe status `trial`
   - [ ] `subscription_ends_at` = NOW + 14 dias
   - [ ] Cliente Stripe é criado
   - [ ] Email de boas-vindas enviado

2. **Expiração de Trial**
   - [ ] Após 14 dias, status muda para `expired`
   - [ ] Funcionalidades são bloqueadas
   - [ ] Modal de upgrade aparece
   - [ ] Email de expiração enviado

3. **Checkout**
   - [ ] Sessão de checkout criada
   - [ ] Redirecionamento para Stripe funciona
   - [ ] Callback de sucesso processa corretamente
   - [ ] Status muda para `active`

4. **Webhooks**
   - [ ] `checkout.session.completed` atualiza usuário
   - [ ] `invoice.paid` registra pagamento
   - [ ] `invoice.payment_failed` notifica usuário
   - [ ] `customer.subscription.deleted` processa cancelamento

5. **Cancelamento**
   - [ ] Usuário pode cancelar pelo portal
   - [ ] Acesso mantido até fim do período
   - [ ] Email de cancelamento enviado
   - [ ] Possível reativar

### 18.2 Cartões de Teste Stripe

```
Sucesso: 4242 4242 4242 4242
Falha: 4000 0000 0000 0002
Requer autenticação: 4000 0025 0000 3155
```

---

## 19. Segurança

### 19.1 Checklist

- [ ] Webhook signature verification
- [ ] Não expor chaves secretas no frontend
- [ ] Rate limiting em endpoints de checkout
- [ ] Validar `customer_id` pertence ao usuário
- [ ] Logs de auditoria para todas ações de billing
- [ ] HTTPS obrigatório para webhooks
- [ ] Sanitizar dados antes de enviar ao Stripe

### 19.2 Logs de Auditoria

Todas as ações de billing devem ser logadas em `subscription_history`:
- Criação de assinatura
- Alteração de plano
- Cancelamento
- Pagamentos (sucesso/falha)
- Alteração de método de pagamento

---

## 20. Cronograma de Implementação Sugerido

### Fase 1: Infraestrutura (Prioridade Alta)
1. Migrations de banco de dados
2. Configuração do Stripe
3. Serviço stripe-service.js
4. Middleware de subscription

### Fase 2: Fluxo Principal
5. Rotas de checkout
6. Webhook handlers
7. Lógica de trial
8. Bloqueio de funcionalidades

### Fase 3: Interface
9. Página de preços
10. Banner de trial
11. Modal de bloqueio
12. Página de billing

### Fase 4: Comunicação
13. Templates de email
14. Jobs de lembrete
15. Notificações in-app

### Fase 5: Testes e Deploy
16. Testes end-to-end
17. Configuração produção
18. Monitoramento

---

## 21. Métricas e Analytics

### 21.1 KPIs a Monitorar

- Taxa de conversão trial → pago
- Churn rate mensal
- MRR (Monthly Recurring Revenue)
- ARPU (Average Revenue Per User)
- Tempo médio de trial usado
- Motivos de cancelamento

### 21.2 Eventos para Analytics

```javascript
// Eventos a trackear
analytics.track('trial_started', { userId, plan: 'pro' });
analytics.track('trial_expired', { userId, converted: false });
analytics.track('checkout_started', { userId, plan, billing_cycle });
analytics.track('subscription_activated', { userId, plan, amount });
analytics.track('subscription_canceled', { userId, reason });
analytics.track('payment_failed', { userId, amount });
```

---

## Resumo dos Arquivos a Criar/Modificar

### Novos Arquivos
- `/services/stripe-service.js`
- `/middleware/subscription.js`
- `/routes/stripe.js`
- `/jobs/subscription-jobs.js`
- `/views/pricing.html`
- `/views/billing.html`
- `/views/checkout.html`
- `/views/trial-expired.html`
- `/views/spa/billing.html`
- `/views/emails/trial-*.html`
- `/views/emails/subscription-*.html`
- `/views/emails/payment-*.html`

### Arquivos a Modificar
- `/database.js` - Novas funções
- `/server.js` - Novas rotas
- `/routes/auth.js` - Trial no registro
- `/routes/clients.js` - Verificação de subscription
- `/middleware/auth.js` - Info de subscription
- `/views/spa/dashboard.html` - Banner de trial
- `/views/app.html` - Modal de bloqueio
- `/.env` - Variáveis Stripe
- `/.env.example` - Template
- `/package.json` - Dependência stripe

---

**Documento criado em:** 30/01/2026
**Versão:** 1.0
**Autor:** Claude (Análise de Sistema)
