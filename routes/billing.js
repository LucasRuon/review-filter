const express = require('express');
const db = require('../database');
const stripeService = require('../services/stripe-service');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

// Verificar se Stripe esta configurado
router.get('/status', authMiddleware, (req, res) => {
    res.json({
        configured: stripeService.isConfigured(),
        priceId: process.env.STRIPE_PRICE_WHATSAPP_INSTANCE ? 'configured' : 'missing'
    });
});

// Criar sessao de checkout para nova instancia WhatsApp
router.post('/create-checkout', authMiddleware, async (req, res) => {
    try {
        if (!stripeService.isConfigured()) {
            return res.status(503).json({ error: 'Sistema de pagamento nao configurado' });
        }

        const { clientId } = req.body;
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        const session = await stripeService.createCheckoutSession(
            req.userId,
            clientId || null,
            `${baseUrl}/app#integrations?checkout=success`,
            `${baseUrl}/app#integrations?checkout=cancelled`
        );

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        logger.error('Create checkout error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao criar sessao de checkout' });
    }
});

// Portal de gerenciamento do Stripe
router.get('/portal', authMiddleware, async (req, res) => {
    try {
        if (!stripeService.isConfigured()) {
            return res.status(503).json({ error: 'Sistema de pagamento nao configurado' });
        }

        const user = await db.getUserWithSubscription(req.userId);
        if (!user || !user.stripe_customer_id) {
            return res.status(400).json({ error: 'Nenhuma assinatura encontrada' });
        }

        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        const session = await stripeService.createBillingPortalSession(
            user.stripe_customer_id,
            `${baseUrl}/app#integrations`
        );

        res.json({
            success: true,
            url: session.url
        });
    } catch (error) {
        logger.error('Billing portal error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao acessar portal de pagamento' });
    }
});

// Listar faturas
router.get('/invoices', authMiddleware, async (req, res) => {
    try {
        if (!stripeService.isConfigured()) {
            return res.status(503).json({ error: 'Sistema de pagamento nao configurado' });
        }

        const user = await db.getUserWithSubscription(req.userId);
        if (!user || !user.stripe_customer_id) {
            return res.json({ invoices: [] });
        }

        const invoices = await stripeService.listInvoices(user.stripe_customer_id);

        res.json({
            success: true,
            invoices
        });
    } catch (error) {
        logger.error('List invoices error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao listar faturas' });
    }
});

// Webhook do Stripe (sem authMiddleware, usa assinatura do webhook)
// IMPORTANTE: Esta rota precisa receber raw body, configurada no server.js
router.post('/webhook', async (req, res) => {
    try {
        if (!stripeService.isConfigured()) {
            return res.status(503).json({ error: 'Stripe nao configurado' });
        }

        const signature = req.headers['stripe-signature'];
        if (!signature) {
            logger.warn('Webhook without signature');
            return res.status(400).json({ error: 'Assinatura ausente' });
        }

        let event;
        try {
            event = stripeService.verifyWebhookSignature(req.body, signature);
        } catch (err) {
            logger.error('Webhook signature verification failed', { error: err.message });
            return res.status(400).json({ error: 'Assinatura invalida' });
        }

        // Processar evento
        await stripeService.handleWebhookEvent(event);

        res.json({ received: true });
    } catch (error) {
        logger.error('Webhook error', { error: error.message });
        res.status(500).json({ error: 'Erro ao processar webhook' });
    }
});

// Verificar se usuario pode criar instancia gratuita
router.get('/can-create-free', authMiddleware, async (req, res) => {
    try {
        const hasFree = await db.hasUserFreeInstance(req.userId);

        res.json({
            canCreateFree: !hasFree,
            reason: hasFree ? 'Voce ja possui uma instancia gratuita' : null
        });
    } catch (error) {
        logger.error('Check free instance error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao verificar elegibilidade' });
    }
});

// ========== SUBSCRIPTION MANAGEMENT ROUTES ==========

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

        const settings = await db.getAllPlatformSettings();
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

        const settings = await db.getAllPlatformSettings();
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
        const settings = await db.getAllPlatformSettings();

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

module.exports = router;
