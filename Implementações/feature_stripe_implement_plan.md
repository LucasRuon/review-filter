# Plano de Implementacao - Stripe com Trial de 14 Dias

## Resumo Executivo

Este documento detalha o plano de implementacao para expandir a integracao Stripe existente, adicionando sistema de trial de 14 dias com bloqueio automatico de funcionalidades.

---

## 1. Analise do Estado Atual

### 1.1 O Que Ja Existe

| Componente | Status | Arquivo | Observacoes |
|------------|--------|---------|-------------|
| Stripe SDK | Implementado | `package.json` | stripe v20.3.0 |
| StripeService | Implementado | `/services/stripe-service.js` | 344 linhas |
| Rotas Billing | Implementado | `/routes/billing.js` | 145 linhas |
| Campos DB Users | Implementado | `/database.js` | subscription_status, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_ends_at |
| Config trial_days | Implementado | `/database.js` | platform_settings['trial_days'] = '14' |
| Webhook Handler | Implementado | `/routes/billing.js` + `/server.js` | Signature verification OK |
| Customer Creation | Implementado | `stripe-service.js:23-65` | createOrGetCustomer() |
| Checkout Session | Implementado | `stripe-service.js:67-111` | Para WhatsApp instances |
| Billing Portal | Implementado | `stripe-service.js:113-127` | Portal Stripe |
| Invoice List | Implementado | `stripe-service.js:150-176` | listInvoices() |

### 1.2 O Que Falta Implementar

| Componente | Prioridade | Complexidade | Descricao |
|------------|------------|--------------|-----------|
| Trial automatico no registro | Alta | Baixa | Iniciar trial de 14 dias |
| Middleware subscription | Alta | Media | Verificar status antes de acoes |
| Processamento trial expirado | Alta | Media | Job para expirar trials |
| Bloqueio de funcionalidades | Alta | Media | Impedir acoes quando expirado |
| Novos campos DB users | Alta | Baixa | trial_started_at, billing_email, etc |
| Tabela subscription_history | Media | Baixa | Audit log de eventos |
| Tabela invoices (local) | Media | Baixa | Cache de faturas |
| Emails transacionais | Media | Media | 8 templates de email |
| Pagina de precos | Media | Media | /pricing com planos |
| Banner de trial | Media | Baixa | UI no dashboard |
| Modal de bloqueio | Media | Baixa | UI quando expirado |
| Jobs agendados | Media | Media | Lembretes e expiracao |
| Pagina billing | Baixa | Media | Gestao de assinatura |
| Analytics/metricas | Baixa | Baixa | KPIs de conversao |

---

## 2. Arquitetura da Solucao

### 2.1 Fluxo de Estados

```
REGISTRO
    |
    v
[trial] ---(14 dias)---> [expired] ---(pagamento)---> [active]
    |                         |                           |
    |                         |                           v
    +---(pagamento)-----------+----------------------->[active]
                                                          |
                                                          v
                                                    [canceled]
                                                          |
                                                          v
                                                      [free]
```

### 2.2 Estados de Subscription

| Status | Acesso | Transicoes Possiveis |
|--------|--------|----------------------|
| `trial` | Completo (PRO) | -> expired, active |
| `active` | Conforme plano | -> canceled, past_due |
| `expired` | Bloqueado | -> active, free |
| `past_due` | Limitado (7 dias) | -> active, canceled |
| `canceled` | Ate fim periodo | -> active, free |
| `free` | Limitado | -> trial (novo), active |

---

## 3. Ordem de Implementacao

### Fase 1: Infraestrutura de Banco (Prioridade: CRITICA)

**Tempo estimado: 1-2 horas**

#### 3.1.1 Novos Campos na Tabela `users`

```sql
-- Arquivo: /migrations/002_subscription_fields.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminder_sent INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_ends_at ON users(subscription_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_trial_started_at ON users(trial_started_at);
```

#### 3.1.2 Nova Tabela `subscription_history`

```sql
-- Arquivo: /migrations/003_subscription_history.sql

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

CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_event_type ON subscription_history(event_type);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at);
```

#### 3.1.3 Nova Tabela `invoices` (Cache Local)

```sql
-- Arquivo: /migrations/004_invoices.sql

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

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

#### 3.1.4 Novas Configuracoes de Plataforma

```sql
-- Adicionar ao init() ou migration separada

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
```

#### Arquivos a Modificar:
- `/database.js` - Adicionar migrations e novas funcoes

---

### Fase 2: Funcoes de Database (Prioridade: CRITICA)

**Tempo estimado: 2-3 horas**

#### 3.2.1 Adicionar ao `/database.js`

```javascript
// Funcoes a adicionar no database.js

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
        isPastDue: user.subscription_status === 'past_due'
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
 * Obtem limites do plano
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

// Adicionar aos exports
module.exports = {
    // ... exports existentes ...
    logSubscriptionEvent,
    getSubscriptionInfo,
    updateSubscriptionStatus,
    startUserTrial,
    getUsersWithExpiringTrial,
    getUsersWithExpiredTrial,
    markTrialReminderSent,
    getPlanLimits,
    checkUserLimit
};
```

---

### Fase 3: Middleware de Subscription (Prioridade: ALTA)

**Tempo estimado: 2-3 horas**

#### 3.3.1 Criar `/middleware/subscription.js`

```javascript
/**
 * Subscription Middleware
 * Verifica status da assinatura e bloqueia acesso conforme necessario
 */

const db = require('../database');
const logger = require('../logger');

/**
 * Middleware que carrega info de subscription no request
 * Nao bloqueia, apenas enriquece req.subscription
 */
async function loadSubscriptionInfo(req, res, next) {
    if (!req.userId) {
        return next();
    }

    try {
        const subInfo = await db.getSubscriptionInfo(req.userId);

        if (subInfo) {
            // Verificar e atualizar status automaticamente
            if (subInfo.isTrialing && subInfo.isExpired && subInfo.status !== 'expired') {
                await db.updateSubscriptionStatus(req.userId, 'expired');
                subInfo.status = 'expired';
                subInfo.isExpired = true;
                subInfo.isActive = false;
            }
        }

        req.subscription = subInfo || {
            status: 'free',
            plan: 'free',
            isTrialing: false,
            isActive: false,
            isExpired: false
        };

        next();
    } catch (error) {
        logger.error('Error loading subscription info', { userId: req.userId, error: error.message });
        req.subscription = { status: 'unknown', isActive: false };
        next();
    }
}

/**
 * Verifica se usuario tem subscription ativa
 * @param {string} level - 'any', 'paid', 'pro', 'enterprise'
 */
function requireSubscription(level = 'any') {
    return async (req, res, next) => {
        // Garantir que subscription info esta carregada
        if (!req.subscription) {
            await loadSubscriptionInfo(req, res, () => {});
        }

        const sub = req.subscription;

        // Verificar nivel de acesso
        let hasAccess = false;

        switch (level) {
            case 'any':
                hasAccess = sub.isActive || sub.status === 'trial';
                break;
            case 'paid':
                hasAccess = sub.status === 'active';
                break;
            case 'pro':
                hasAccess = sub.isActive && ['pro', 'enterprise'].includes(sub.plan);
                break;
            case 'enterprise':
                hasAccess = sub.isActive && sub.plan === 'enterprise';
                break;
            default:
                hasAccess = sub.isActive;
        }

        if (!hasAccess) {
            return res.status(403).json({
                error: true,
                code: 'SUBSCRIPTION_REQUIRED',
                message: getBlockMessage(sub.status),
                subscription: {
                    status: sub.status,
                    plan: sub.plan,
                    daysRemaining: sub.daysRemaining,
                    endsAt: sub.endsAt
                },
                upgrade_url: '/pricing'
            });
        }

        next();
    };
}

/**
 * Verifica limite especifico do plano
 */
function checkPlanLimit(limitKey) {
    return async (req, res, next) => {
        if (!req.userId) {
            return res.status(401).json({ error: 'Nao autenticado' });
        }

        try {
            const limitCheck = await db.checkUserLimit(req.userId, limitKey);

            if (!limitCheck.allowed) {
                return res.status(403).json({
                    error: true,
                    code: 'PLAN_LIMIT_REACHED',
                    message: `Voce atingiu o limite de ${limitKey} do seu plano`,
                    limit: {
                        type: limitKey,
                        current: limitCheck.current,
                        max: limitCheck.limit
                    },
                    upgrade_url: '/pricing'
                });
            }

            req.limitCheck = limitCheck;
            next();
        } catch (error) {
            logger.error('Error checking plan limit', {
                userId: req.userId,
                limitKey,
                error: error.message
            });
            next(); // Em caso de erro, permitir acao
        }
    };
}

/**
 * Verifica se feature esta disponivel no plano
 */
function requireFeature(featureName) {
    return async (req, res, next) => {
        if (!req.subscription) {
            await loadSubscriptionInfo(req, res, () => {});
        }

        const limits = await db.getPlanLimits(req.subscription.plan);

        if (!limits.features[featureName]) {
            return res.status(403).json({
                error: true,
                code: 'FEATURE_NOT_AVAILABLE',
                message: `Esta funcionalidade nao esta disponivel no seu plano`,
                feature: featureName,
                upgrade_url: '/pricing'
            });
        }

        next();
    };
}

function getBlockMessage(status) {
    const messages = {
        'expired': 'Seu periodo de teste expirou. Faca upgrade para continuar.',
        'past_due': 'Seu pagamento esta atrasado. Atualize seus dados de pagamento.',
        'canceled': 'Sua assinatura foi cancelada.',
        'free': 'Esta funcionalidade requer um plano pago.',
        'default': 'Assinatura necessaria para acessar este recurso.'
    };
    return messages[status] || messages.default;
}

module.exports = {
    loadSubscriptionInfo,
    requireSubscription,
    checkPlanLimit,
    requireFeature
};
```

---

### Fase 4: Modificar Registro para Trial (Prioridade: ALTA)

**Tempo estimado: 1 hora**

#### 3.4.1 Modificar `/routes/auth.js`

```javascript
// Adicionar no POST /register, apos criar usuario:

// Importar no topo
const stripeService = require('../services/stripe-service');

// Dentro de router.post('/register', ...)
// Apos: const result = await db.createUser(...)

// Iniciar trial
const trialDays = await db.getSetting('trial_days') || '14';
const trialEndsAt = await db.startUserTrial(result.id, parseInt(trialDays));

// Criar cliente Stripe (nao bloqueante)
try {
    await stripeService.createOrGetCustomer(result.id, email, name);
} catch (stripeError) {
    logger.warn('Failed to create Stripe customer on register', {
        userId: result.id,
        error: stripeError.message
    });
    // Nao bloquear registro por falha no Stripe
}

// Enviar email de boas-vindas com info de trial
try {
    await emailService.sendTrialStartedEmail(email, name, parseInt(trialDays));
} catch (emailError) {
    logger.warn('Failed to send trial started email', {
        userId: result.id,
        error: emailError.message
    });
}

logger.info('User registered with trial', {
    userId: result.id,
    email,
    trialDays,
    trialEndsAt
});
```

---

### Fase 5: Proteger Rotas com Middleware (Prioridade: ALTA)

**Tempo estimado: 2-3 horas**

#### 3.5.1 Modificar `/routes/clients.js`

```javascript
// Adicionar imports
const { requireSubscription, checkPlanLimit, loadSubscriptionInfo } = require('../middleware/subscription');

// Proteger rotas de criacao/edicao
router.post('/',
    authMiddleware,
    requireSubscription('any'),
    checkPlanLimit('clients'),
    async (req, res) => { /* ... */ }
);

router.put('/:id',
    authMiddleware,
    requireSubscription('any'),
    async (req, res) => { /* ... */ }
);

router.delete('/:id',
    authMiddleware,
    requireSubscription('any'),
    async (req, res) => { /* ... */ }
);

// GET pode ser acessado mesmo com trial expirado (apenas leitura)
router.get('/',
    authMiddleware,
    loadSubscriptionInfo,
    async (req, res) => { /* ... */ }
);
```

#### 3.5.2 Modificar outras rotas protegidas

Aplicar mesma logica em:
- `/routes/clients.js` - Todas as sub-rotas (branches, topics, complaints)
- `/routes/whatsapp.js` - Todas as rotas
- Qualquer outra rota que modifique dados

---

### Fase 6: Expandir Stripe Service (Prioridade: MEDIA)

**Tempo estimado: 3-4 horas**

#### 3.6.1 Adicionar ao `/services/stripe-service.js`

```javascript
// Novos metodos a adicionar

/**
 * Cria sessao de checkout para plano de assinatura (nao WhatsApp instance)
 */
async createPlanCheckoutSession(userId, priceId, successUrl, cancelUrl) {
    if (!this.isConfigured()) {
        throw new Error('Stripe nao configurado');
    }

    const user = await db.getUserWithSubscription(userId);
    if (!user) {
        throw new Error('Usuario nao encontrado');
    }

    const customerId = await this.createOrGetCustomer(userId, user.email, user.name);

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
            price: priceId,
            quantity: 1
        }],
        metadata: {
            user_id: userId.toString(),
            type: 'platform_subscription'
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: 'pt-BR',
        billing_address_collection: 'auto',
        allow_promotion_codes: true,
        subscription_data: {
            metadata: {
                user_id: userId.toString()
            }
        }
    });

    logger.info('Plan checkout session created', {
        userId,
        priceId,
        sessionId: session.id
    });

    return session;
}

/**
 * Cancela assinatura do usuario
 */
async cancelUserSubscription(userId, immediate = false, reason = null) {
    const user = await db.getUserWithSubscription(userId);
    if (!user || !user.stripe_subscription_id) {
        throw new Error('Nenhuma assinatura encontrada');
    }

    const subscription = await stripe.subscriptions.update(
        user.stripe_subscription_id,
        {
            cancel_at_period_end: !immediate,
            metadata: {
                cancellation_reason: reason || 'user_requested'
            }
        }
    );

    if (immediate) {
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
    }

    // Atualizar banco
    await db.pool.query(`
        UPDATE users SET
            cancellation_reason = $1,
            cancelled_at = NOW()
        WHERE id = $2
    `, [reason, userId]);

    await db.logSubscriptionEvent(userId, 'subscription_canceled', {
        immediate,
        reason,
        ends_at: immediate ? new Date() : new Date(subscription.current_period_end * 1000)
    });

    return subscription;
}

/**
 * Reativa assinatura cancelada
 */
async reactivateSubscription(userId) {
    const user = await db.getUserWithSubscription(userId);
    if (!user || !user.stripe_subscription_id) {
        throw new Error('Nenhuma assinatura encontrada');
    }

    const subscription = await stripe.subscriptions.update(
        user.stripe_subscription_id,
        { cancel_at_period_end: false }
    );

    await db.updateSubscriptionStatus(userId, 'active');
    await db.logSubscriptionEvent(userId, 'subscription_reactivated', {});

    return subscription;
}

/**
 * Altera plano da assinatura
 */
async changePlan(userId, newPriceId, prorate = true) {
    const user = await db.getUserWithSubscription(userId);
    if (!user || !user.stripe_subscription_id) {
        throw new Error('Nenhuma assinatura encontrada');
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    const currentItemId = subscription.items.data[0]?.id;

    if (!currentItemId) {
        throw new Error('Item de assinatura nao encontrado');
    }

    const updatedSubscription = await stripe.subscriptions.update(
        user.stripe_subscription_id,
        {
            items: [{
                id: currentItemId,
                price: newPriceId
            }],
            proration_behavior: prorate ? 'create_prorations' : 'none'
        }
    );

    // Determinar novo plano pelo price ID
    const newPlan = await this.getPlanFromPriceId(newPriceId);
    await db.updateSubscriptionStatus(userId, 'active', newPlan);
    await db.logSubscriptionEvent(userId, 'plan_changed', {
        old_plan: user.subscription_plan,
        new_plan: newPlan,
        new_price_id: newPriceId
    });

    return updatedSubscription;
}

/**
 * Retorna plano baseado no Price ID
 */
async getPlanFromPriceId(priceId) {
    const settings = await db.getAllSettings();

    if (priceId === settings.stripe_price_id_pro_monthly ||
        priceId === settings.stripe_price_id_pro_yearly) {
        return 'pro';
    }
    if (priceId === settings.stripe_price_id_enterprise_monthly ||
        priceId === settings.stripe_price_id_enterprise_yearly) {
        return 'enterprise';
    }
    return 'free';
}

/**
 * Retorna proxima fatura
 */
async getUpcomingInvoice(customerId) {
    if (!this.isConfigured()) {
        throw new Error('Stripe nao configurado');
    }

    try {
        const invoice = await stripe.invoices.retrieveUpcoming({
            customer: customerId
        });

        return {
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            period_start: new Date(invoice.period_start * 1000),
            period_end: new Date(invoice.period_end * 1000),
            next_payment_attempt: invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000)
                : null
        };
    } catch (error) {
        if (error.code === 'invoice_upcoming_none') {
            return null;
        }
        throw error;
    }
}

// Atualizar handleCheckoutCompleted para planos de plataforma
async handleCheckoutCompleted(session) {
    const metadata = session.metadata || {};
    const userId = parseInt(metadata.user_id);

    if (!userId) {
        logger.warn('Invalid checkout session metadata', { metadata });
        return;
    }

    // Checkout de plano de plataforma
    if (metadata.type === 'platform_subscription') {
        logger.info('Platform subscription checkout completed', {
            userId,
            sessionId: session.id
        });

        // Buscar subscription para obter detalhes
        if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const priceId = subscription.items.data[0]?.price?.id;
            const plan = await this.getPlanFromPriceId(priceId);
            const endsAt = new Date(subscription.current_period_end * 1000);

            await db.pool.query(`
                UPDATE users SET
                    subscription_status = 'active',
                    subscription_plan = $1,
                    stripe_subscription_id = $2,
                    subscription_ends_at = $3,
                    last_payment_at = NOW()
                WHERE id = $4
            `, [plan, session.subscription, endsAt, userId]);

            await db.logSubscriptionEvent(userId, 'subscription_activated', {
                plan,
                subscription_id: session.subscription,
                ends_at: endsAt.toISOString()
            });
        }
        return;
    }

    // Checkout de WhatsApp instance (codigo existente)
    if (metadata.type === 'whatsapp_instance') {
        // ... codigo existente ...
    }
}
```

---

### Fase 7: Novas Rotas de Billing (Prioridade: MEDIA)

**Tempo estimado: 2 horas**

#### 3.7.1 Adicionar ao `/routes/billing.js`

```javascript
// GET /api/billing/subscription - Info da assinatura atual
router.get('/subscription', authMiddleware, async (req, res) => {
    try {
        const subInfo = await db.getSubscriptionInfo(req.userId);
        const limits = await db.getPlanLimits(subInfo?.plan || 'free');

        res.json({
            success: true,
            subscription: subInfo,
            limits
        });
    } catch (error) {
        logger.error('Get subscription info error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao obter informacoes da assinatura' });
    }
});

// POST /api/billing/subscribe - Criar checkout para plano
router.post('/subscribe', authMiddleware, async (req, res) => {
    try {
        if (!stripeService.isConfigured()) {
            return res.status(503).json({ error: 'Sistema de pagamento nao configurado' });
        }

        const { plan, billing_cycle } = req.body; // plan: pro/enterprise, billing_cycle: monthly/yearly

        const settings = await db.getAllSettings();
        const priceKey = `stripe_price_id_${plan}_${billing_cycle}`;
        const priceId = settings[priceKey];

        if (!priceId) {
            return res.status(400).json({ error: 'Plano nao configurado' });
        }

        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        const session = await stripeService.createPlanCheckoutSession(
            req.userId,
            priceId,
            `${baseUrl}/app#settings?checkout=success`,
            `${baseUrl}/pricing?checkout=cancelled`
        );

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        logger.error('Subscribe error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao criar assinatura' });
    }
});

// POST /api/billing/cancel - Cancelar assinatura
router.post('/cancel', authMiddleware, async (req, res) => {
    try {
        const { immediate, reason } = req.body;

        await stripeService.cancelUserSubscription(req.userId, immediate, reason);

        res.json({
            success: true,
            message: immediate
                ? 'Assinatura cancelada imediatamente'
                : 'Assinatura sera cancelada ao fim do periodo'
        });
    } catch (error) {
        logger.error('Cancel subscription error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao cancelar assinatura' });
    }
});

// POST /api/billing/reactivate - Reativar assinatura
router.post('/reactivate', authMiddleware, async (req, res) => {
    try {
        await stripeService.reactivateSubscription(req.userId);

        res.json({
            success: true,
            message: 'Assinatura reativada com sucesso'
        });
    } catch (error) {
        logger.error('Reactivate subscription error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao reativar assinatura' });
    }
});

// POST /api/billing/change-plan - Alterar plano
router.post('/change-plan', authMiddleware, async (req, res) => {
    try {
        const { plan, billing_cycle } = req.body;

        const settings = await db.getAllSettings();
        const priceKey = `stripe_price_id_${plan}_${billing_cycle}`;
        const priceId = settings[priceKey];

        if (!priceId) {
            return res.status(400).json({ error: 'Plano nao configurado' });
        }

        await stripeService.changePlan(req.userId, priceId);

        res.json({
            success: true,
            message: 'Plano alterado com sucesso'
        });
    } catch (error) {
        logger.error('Change plan error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao alterar plano' });
    }
});

// GET /api/billing/upcoming-invoice - Proxima fatura
router.get('/upcoming-invoice', authMiddleware, async (req, res) => {
    try {
        const user = await db.getUserWithSubscription(req.userId);
        if (!user?.stripe_customer_id) {
            return res.json({ invoice: null });
        }

        const invoice = await stripeService.getUpcomingInvoice(user.stripe_customer_id);

        res.json({
            success: true,
            invoice
        });
    } catch (error) {
        logger.error('Get upcoming invoice error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao obter proxima fatura' });
    }
});

// GET /api/billing/plans - Lista planos disponiveis
router.get('/plans', async (req, res) => {
    try {
        const settings = await db.getAllSettings();

        const plans = [
            {
                id: 'free',
                name: 'Gratuito',
                price_monthly: 0,
                price_yearly: 0,
                features: ['1 cliente', '1 filial', 'Suporte por email']
            },
            {
                id: 'pro',
                name: 'PRO',
                price_monthly: parseInt(settings.pro_monthly_price_brl) / 100,
                price_yearly: parseInt(settings.pro_yearly_price_brl) / 100,
                price_id_monthly: settings.stripe_price_id_pro_monthly,
                price_id_yearly: settings.stripe_price_id_pro_yearly,
                features: [
                    '10 clientes',
                    '10 filiais por cliente',
                    'Integracao WhatsApp',
                    'Webhooks',
                    'Relatorios avancados',
                    'Exportacao de dados'
                ]
            },
            {
                id: 'enterprise',
                name: 'Enterprise',
                price_monthly: parseInt(settings.enterprise_monthly_price_brl) / 100,
                price_yearly: parseInt(settings.enterprise_yearly_price_brl) / 100,
                price_id_monthly: settings.stripe_price_id_enterprise_monthly,
                price_id_yearly: settings.stripe_price_id_enterprise_yearly,
                features: [
                    'Clientes ilimitados',
                    'Filiais ilimitadas',
                    'Tudo do PRO',
                    'Dominio personalizado',
                    'API access',
                    'Suporte prioritario'
                ]
            }
        ];

        res.json({
            success: true,
            plans,
            yearly_discount: parseInt(settings.yearly_discount_percent) || 20
        });
    } catch (error) {
        logger.error('Get plans error', { error: error.message });
        res.status(500).json({ error: 'Erro ao listar planos' });
    }
});
```

---

### Fase 8: Jobs Agendados (Prioridade: MEDIA)

**Tempo estimado: 2-3 horas**

#### 3.8.1 Criar `/jobs/subscription-jobs.js`

```javascript
/**
 * Jobs agendados para gerenciamento de subscriptions
 */

const cron = require('node-cron');
const db = require('../database');
const emailService = require('../services/email-service');
const logger = require('../logger');

/**
 * Envia lembretes de trial expirando
 * Executa diariamente as 9h
 */
async function processTrialReminders() {
    logger.info('Starting trial reminders job');

    try {
        // Lembrete 3 dias antes
        const users3Days = await db.getUsersWithExpiringTrial(3);
        for (const user of users3Days) {
            if (user.trial_reminder_sent < 3) {
                try {
                    await emailService.sendTrialReminder(user.email, user.name, 3);
                    await db.markTrialReminderSent(user.id, 3);
                    logger.info('Trial reminder sent (3 days)', { userId: user.id });
                } catch (error) {
                    logger.error('Failed to send trial reminder', {
                        userId: user.id,
                        error: error.message
                    });
                }
            }
        }

        // Lembrete 1 dia antes
        const users1Day = await db.getUsersWithExpiringTrial(1);
        for (const user of users1Day) {
            if (user.trial_reminder_sent < 1) {
                try {
                    await emailService.sendTrialReminder(user.email, user.name, 1);
                    await db.markTrialReminderSent(user.id, 1);
                    logger.info('Trial reminder sent (1 day)', { userId: user.id });
                } catch (error) {
                    logger.error('Failed to send trial reminder', {
                        userId: user.id,
                        error: error.message
                    });
                }
            }
        }

        logger.info('Trial reminders job completed', {
            reminders3Days: users3Days.length,
            reminders1Day: users1Day.length
        });
    } catch (error) {
        logger.error('Trial reminders job failed', { error: error.message });
    }
}

/**
 * Processa trials expirados
 * Executa a cada hora
 */
async function processExpiredTrials() {
    logger.info('Starting expired trials job');

    try {
        const expiredUsers = await db.getUsersWithExpiredTrial();

        for (const user of expiredUsers) {
            try {
                await db.updateSubscriptionStatus(user.id, 'expired');
                await db.logSubscriptionEvent(user.id, 'trial_expired', {
                    ended_at: user.subscription_ends_at
                });

                // Enviar email de trial expirado
                await emailService.sendTrialExpiredEmail(user.email, user.name);

                logger.info('Trial expired', { userId: user.id });
            } catch (error) {
                logger.error('Failed to process expired trial', {
                    userId: user.id,
                    error: error.message
                });
            }
        }

        logger.info('Expired trials job completed', { processed: expiredUsers.length });
    } catch (error) {
        logger.error('Expired trials job failed', { error: error.message });
    }
}

/**
 * Sincroniza status com Stripe
 * Executa diariamente a meia-noite
 */
async function syncSubscriptionStatus() {
    logger.info('Starting subscription sync job');

    try {
        const result = await db.pool.query(`
            SELECT id, stripe_subscription_id FROM users
            WHERE stripe_subscription_id IS NOT NULL
        `);

        const stripeService = require('../services/stripe-service');
        let synced = 0;

        for (const user of result.rows) {
            try {
                // Verificar status no Stripe
                const Stripe = require('stripe');
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
                const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

                let newStatus = 'active';
                if (subscription.status === 'canceled') newStatus = 'canceled';
                if (subscription.status === 'past_due') newStatus = 'past_due';
                if (subscription.status === 'unpaid') newStatus = 'expired';

                await db.updateSubscriptionStatus(
                    user.id,
                    newStatus,
                    null,
                    new Date(subscription.current_period_end * 1000)
                );
                synced++;
            } catch (error) {
                logger.error('Failed to sync subscription', {
                    userId: user.id,
                    error: error.message
                });
            }
        }

        logger.info('Subscription sync job completed', { synced, total: result.rows.length });
    } catch (error) {
        logger.error('Subscription sync job failed', { error: error.message });
    }
}

/**
 * Inicializa os jobs
 */
function initJobs() {
    // Lembretes de trial - diariamente as 9h
    cron.schedule('0 9 * * *', processTrialReminders);

    // Trials expirados - a cada hora
    cron.schedule('0 * * * *', processExpiredTrials);

    // Sincronizacao com Stripe - diariamente a meia-noite
    cron.schedule('0 0 * * *', syncSubscriptionStatus);

    logger.info('Subscription jobs initialized');
}

module.exports = {
    initJobs,
    processTrialReminders,
    processExpiredTrials,
    syncSubscriptionStatus
};
```

#### 3.8.2 Registrar jobs no `server.js`

```javascript
// Adicionar apos inicializacao do servidor
const subscriptionJobs = require('./jobs/subscription-jobs');
subscriptionJobs.initJobs();
```

---

### Fase 9: Templates de Email (Prioridade: MEDIA)

**Tempo estimado: 2-3 horas**

#### 3.9.1 Adicionar ao `/services/email-service.js`

```javascript
// Adicionar novos metodos

async sendTrialStartedEmail(email, name, trialDays) {
    const subject = 'Bem-vindo ao Opina Ja! Seu trial de ' + trialDays + ' dias comecou';
    const html = `
        <h1>Ola ${name}!</h1>
        <p>Seu periodo de teste de ${trialDays} dias no Opina Ja comecou.</p>
        <p>Durante esse periodo, voce tera acesso completo a todas as funcionalidades PRO:</p>
        <ul>
            <li>Ate 10 clientes</li>
            <li>Integracao com WhatsApp</li>
            <li>Webhooks personalizados</li>
            <li>Relatorios avancados</li>
            <li>Exportacao de dados</li>
        </ul>
        <p>Aproveite ao maximo!</p>
        <a href="${process.env.BASE_URL}/app" style="...">Acessar Dashboard</a>
    `;
    return this.sendEmail(email, subject, html);
}

async sendTrialReminder(email, name, daysRemaining) {
    const subject = daysRemaining === 1
        ? 'Ultimo dia do seu trial no Opina Ja!'
        : `Seu trial expira em ${daysRemaining} dias`;

    const html = `
        <h1>Ola ${name}!</h1>
        <p>${daysRemaining === 1
            ? 'Hoje e o ultimo dia do seu periodo de teste!'
            : `Restam apenas ${daysRemaining} dias do seu periodo de teste.`
        }</p>
        <p>Para continuar usando todas as funcionalidades, faca upgrade para um plano pago.</p>
        <a href="${process.env.BASE_URL}/pricing" style="...">Ver Planos</a>
    `;
    return this.sendEmail(email, subject, html);
}

async sendTrialExpiredEmail(email, name) {
    const subject = 'Seu periodo de teste terminou';
    const html = `
        <h1>Ola ${name}!</h1>
        <p>Seu periodo de teste no Opina Ja terminou.</p>
        <p>Algumas funcionalidades foram bloqueadas, mas voce ainda pode:</p>
        <ul>
            <li>Visualizar seus dados</li>
            <li>Acessar configuracoes</li>
            <li>Fazer upgrade a qualquer momento</li>
        </ul>
        <p>Para desbloquear todas as funcionalidades, escolha um plano:</p>
        <a href="${process.env.BASE_URL}/pricing" style="...">Fazer Upgrade</a>
    `;
    return this.sendEmail(email, subject, html);
}

async sendSubscriptionActivatedEmail(email, name, plan) {
    const subject = 'Sua assinatura esta ativa!';
    const html = `
        <h1>Obrigado, ${name}!</h1>
        <p>Sua assinatura do plano ${plan.toUpperCase()} foi ativada com sucesso.</p>
        <p>Agora voce tem acesso completo a todas as funcionalidades do seu plano.</p>
        <a href="${process.env.BASE_URL}/app" style="...">Acessar Dashboard</a>
    `;
    return this.sendEmail(email, subject, html);
}

async sendPaymentFailedEmail(email, name) {
    const subject = 'Problema com seu pagamento';
    const html = `
        <h1>Ola ${name}!</h1>
        <p>Houve um problema ao processar seu pagamento.</p>
        <p>Por favor, atualize suas informacoes de pagamento para evitar a interrupcao do servico.</p>
        <a href="${process.env.BASE_URL}/billing" style="...">Atualizar Pagamento</a>
    `;
    return this.sendEmail(email, subject, html);
}

async sendSubscriptionCanceledEmail(email, name, endsAt) {
    const subject = 'Sua assinatura foi cancelada';
    const formattedDate = new Date(endsAt).toLocaleDateString('pt-BR');
    const html = `
        <h1>Ola ${name}!</h1>
        <p>Sua assinatura no Opina Ja foi cancelada.</p>
        <p>Voce ainda tera acesso ate <strong>${formattedDate}</strong>.</p>
        <p>Mudou de ideia? Voce pode reativar sua assinatura a qualquer momento.</p>
        <a href="${process.env.BASE_URL}/billing" style="...">Reativar Assinatura</a>
    `;
    return this.sendEmail(email, subject, html);
}
```

---

### Fase 10: Interface do Usuario (Prioridade: MEDIA)

**Tempo estimado: 4-6 horas**

#### 3.10.1 Banner de Trial no Dashboard

Adicionar ao `/views/spa/dashboard.html` ou `/views/app.html`:

```html
<!-- Trial Banner Component -->
<div id="trial-banner" class="trial-banner" style="display: none;">
    <div class="trial-banner-content">
        <span class="trial-icon"></span>
        <span class="trial-text">
            <strong id="trial-days-left"></strong> dias restantes no seu periodo de teste
        </span>
        <a href="/pricing" class="btn btn-upgrade">Fazer Upgrade</a>
    </div>
</div>

<script>
async function loadTrialBanner() {
    try {
        const response = await fetch('/api/billing/subscription');
        const data = await response.json();

        if (data.subscription?.status === 'trial' && data.subscription?.daysRemaining !== undefined) {
            const banner = document.getElementById('trial-banner');
            const daysEl = document.getElementById('trial-days-left');

            daysEl.textContent = data.subscription.daysRemaining;
            banner.style.display = 'flex';

            // Mudar cor baseado nos dias restantes
            if (data.subscription.daysRemaining <= 1) {
                banner.classList.add('critical');
            } else if (data.subscription.daysRemaining <= 3) {
                banner.classList.add('warning');
            }
        }
    } catch (error) {
        console.error('Error loading trial banner:', error);
    }
}

// Chamar ao carregar pagina
loadTrialBanner();
</script>

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
    gap: 16px;
}

.trial-banner.warning {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.trial-banner.critical {
    background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
}

.trial-banner-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.btn-upgrade {
    background: white;
    color: #667eea;
    padding: 8px 20px;
    border-radius: 6px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
}

.btn-upgrade:hover {
    background: #f0f0f0;
}
</style>
```

#### 3.10.2 Modal de Bloqueio

```html
<!-- Subscription Required Modal -->
<div id="subscription-modal" class="modal" style="display: none;">
    <div class="modal-overlay"></div>
    <div class="modal-content">
        <div class="modal-icon">&#128274;</div>
        <h2>Assinatura Necessaria</h2>
        <p id="subscription-modal-message">Seu periodo de teste expirou.</p>

        <div class="plan-options">
            <div class="plan-card">
                <h3>PRO</h3>
                <div class="price">R$ 97<span>/mes</span></div>
                <button onclick="selectPlan('pro', 'monthly')">Escolher PRO</button>
            </div>

            <div class="plan-card featured">
                <span class="badge">Economize 20%</span>
                <h3>PRO Anual</h3>
                <div class="price">R$ 77,60<span>/mes</span></div>
                <button onclick="selectPlan('pro', 'yearly')">Escolher Anual</button>
            </div>
        </div>

        <a href="#" onclick="closeSubscriptionModal()" class="link-secondary">
            Continuar com acesso limitado
        </a>
    </div>
</div>

<script>
function showSubscriptionModal(message) {
    document.getElementById('subscription-modal-message').textContent = message || 'Assinatura necessaria para continuar.';
    document.getElementById('subscription-modal').style.display = 'flex';
}

function closeSubscriptionModal() {
    document.getElementById('subscription-modal').style.display = 'none';
}

async function selectPlan(plan, billingCycle) {
    try {
        const response = await fetch('/api/billing/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, billing_cycle: billingCycle })
        });

        const data = await response.json();

        if (data.url) {
            window.location.href = data.url;
        } else {
            showToast('Erro ao iniciar checkout', 'error');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        showToast('Erro ao processar pagamento', 'error');
    }
}

// Interceptar erros de API para mostrar modal
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    if (response.status === 403) {
        const data = await response.clone().json();
        if (data.code === 'SUBSCRIPTION_REQUIRED') {
            showSubscriptionModal(data.message);
        }
    }

    return response;
};
</script>
```

#### 3.10.3 Criar `/views/pricing.html`

Pagina completa de precos com:
- Comparativo de planos (Free, Pro, Enterprise)
- Toggle Mensal/Anual
- Botoes de checkout
- FAQ

---

## 4. Checklist de Implementacao

### Fase 1: Banco de Dados
- [ ] Criar migration 002_subscription_fields.sql
- [ ] Criar migration 003_subscription_history.sql
- [ ] Criar migration 004_invoices.sql
- [ ] Adicionar novas platform_settings
- [ ] Executar migrations

### Fase 2: Funcoes Database
- [ ] Implementar logSubscriptionEvent()
- [ ] Implementar getSubscriptionInfo()
- [ ] Implementar updateSubscriptionStatus()
- [ ] Implementar startUserTrial()
- [ ] Implementar getUsersWithExpiringTrial()
- [ ] Implementar getUsersWithExpiredTrial()
- [ ] Implementar markTrialReminderSent()
- [ ] Implementar getPlanLimits()
- [ ] Implementar checkUserLimit()
- [ ] Adicionar exports

### Fase 3: Middleware
- [ ] Criar /middleware/subscription.js
- [ ] Implementar loadSubscriptionInfo()
- [ ] Implementar requireSubscription()
- [ ] Implementar checkPlanLimit()
- [ ] Implementar requireFeature()

### Fase 4: Auth com Trial
- [ ] Modificar POST /register para iniciar trial
- [ ] Criar cliente Stripe no registro
- [ ] Enviar email de boas-vindas

### Fase 5: Proteger Rotas
- [ ] Adicionar middleware em /routes/clients.js
- [ ] Adicionar middleware em sub-rotas de clients
- [ ] Adicionar middleware em /routes/whatsapp.js
- [ ] Testar bloqueio de acoes

### Fase 6: Expandir Stripe Service
- [ ] Implementar createPlanCheckoutSession()
- [ ] Implementar cancelUserSubscription()
- [ ] Implementar reactivateSubscription()
- [ ] Implementar changePlan()
- [ ] Implementar getUpcomingInvoice()
- [ ] Atualizar handleCheckoutCompleted()
- [ ] Atualizar webhook handlers

### Fase 7: Novas Rotas Billing
- [ ] GET /subscription
- [ ] POST /subscribe
- [ ] POST /cancel
- [ ] POST /reactivate
- [ ] POST /change-plan
- [ ] GET /upcoming-invoice
- [ ] GET /plans

### Fase 8: Jobs Agendados
- [ ] Instalar node-cron
- [ ] Criar /jobs/subscription-jobs.js
- [ ] Implementar processTrialReminders()
- [ ] Implementar processExpiredTrials()
- [ ] Implementar syncSubscriptionStatus()
- [ ] Registrar jobs no server.js

### Fase 9: Emails
- [ ] sendTrialStartedEmail()
- [ ] sendTrialReminder() (3 dias e 1 dia)
- [ ] sendTrialExpiredEmail()
- [ ] sendSubscriptionActivatedEmail()
- [ ] sendPaymentFailedEmail()
- [ ] sendSubscriptionCanceledEmail()

### Fase 10: Interface
- [ ] Banner de trial no dashboard
- [ ] Modal de bloqueio
- [ ] Pagina /pricing
- [ ] Pagina /billing
- [ ] Interceptador de erros 403

---

## 5. Variaveis de Ambiente Necessarias

```env
# Adicionar ao .env (alem das existentes)
STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxxxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxxxx
```

---

## 6. Configuracao no Stripe Dashboard

1. **Criar Produtos:**
   - Opina Ja PRO (Mensal: R$ 97,00 / Anual: R$ 931,20)
   - Opina Ja Enterprise (Mensal: R$ 297,00 / Anual: R$ 2.851,20)

2. **Copiar Price IDs** para platform_settings ou .env

3. **Configurar Customer Portal:**
   - Permitir cancelamento
   - Permitir alteracao de plano
   - Permitir atualizacao de pagamento

4. **Webhook Events** (ja configurados, apenas verificar):
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.paid
   - invoice.payment_failed

---

## 7. Dependencias NPM

```bash
npm install node-cron
```

---

## 8. Testes a Realizar

### Cenarios de Trial
- [ ] Registro cria usuario com status 'trial'
- [ ] subscription_ends_at = NOW + 14 dias
- [ ] Stripe customer criado
- [ ] Email de boas-vindas enviado
- [ ] Banner de trial aparece no dashboard

### Cenarios de Expiracao
- [ ] Apos 14 dias, status muda para 'expired'
- [ ] Acoes de criacao/edicao bloqueadas
- [ ] Modal de upgrade aparece
- [ ] Email de expiracao enviado
- [ ] Leitura de dados ainda funciona

### Cenarios de Pagamento
- [ ] Checkout redireciona para Stripe
- [ ] Webhook processa checkout.session.completed
- [ ] Status muda para 'active'
- [ ] Email de ativacao enviado
- [ ] Funcionalidades desbloqueadas

### Cenarios de Cancelamento
- [ ] POST /cancel funciona
- [ ] Acesso mantido ate fim do periodo
- [ ] Email de cancelamento enviado
- [ ] Reativacao funciona

---

## 9. Cronograma Sugerido

| Fase | Descricao | Prioridade | Dependencias |
|------|-----------|------------|--------------|
| 1 | Banco de Dados | CRITICA | Nenhuma |
| 2 | Funcoes Database | CRITICA | Fase 1 |
| 3 | Middleware | ALTA | Fase 2 |
| 4 | Auth com Trial | ALTA | Fases 2, 3 |
| 5 | Proteger Rotas | ALTA | Fase 3 |
| 6 | Stripe Service | MEDIA | Fase 2 |
| 7 | Rotas Billing | MEDIA | Fase 6 |
| 8 | Jobs Agendados | MEDIA | Fases 2, 9 |
| 9 | Emails | MEDIA | Nenhuma |
| 10 | Interface | MEDIA | Fases 5, 7 |

---

**Documento criado em:** 31/01/2026
**Baseado em:** feature_stripe.md + analise do codebase existente
**Autor:** Claude (Analise de Implementacao)
