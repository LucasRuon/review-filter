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

module.exports = router;
