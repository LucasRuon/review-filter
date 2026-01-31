const logger = require('../logger');
const db = require('../database');

// Inicializar Stripe apenas se a chave estiver configurada
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

class StripeService {
    constructor() {
        this.priceId = process.env.STRIPE_PRICE_WHATSAPP_INSTANCE;
    }

    isConfigured() {
        return stripe !== null && this.priceId;
    }

    /**
     * Cria ou retorna customer existente do Stripe
     */
    async createOrGetCustomer(userId, email, name) {
        if (!this.isConfigured()) {
            throw new Error('Stripe nao configurado');
        }

        // Buscar usuario com dados de subscription
        const user = await db.getUserWithSubscription(userId);
        if (!user) {
            throw new Error('Usuario nao encontrado');
        }

        // Se ja tem stripe_customer_id, retornar
        if (user.stripe_customer_id) {
            try {
                const customer = await stripe.customers.retrieve(user.stripe_customer_id);
                if (!customer.deleted) {
                    return user.stripe_customer_id;
                }
            } catch (error) {
                logger.warn('Stripe customer not found, creating new one', {
                    userId,
                    oldCustomerId: user.stripe_customer_id
                });
            }
        }

        // Criar novo customer no Stripe
        const customer = await stripe.customers.create({
            email: email || user.email,
            name: name || user.name,
            metadata: {
                user_id: userId.toString(),
                platform: 'opinaja'
            }
        });

        // Salvar no banco
        await db.updateUserStripeCustomerId(userId, customer.id);

        logger.info('Stripe customer created', { userId, customerId: customer.id });

        return customer.id;
    }

    /**
     * Cria sessao de checkout para nova instancia WhatsApp
     */
    async createCheckoutSession(userId, clientId, successUrl, cancelUrl) {
        if (!this.isConfigured()) {
            throw new Error('Stripe nao configurado');
        }

        const user = await db.getUserWithSubscription(userId);
        if (!user) {
            throw new Error('Usuario nao encontrado');
        }

        // Obter ou criar customer
        const customerId = await this.createOrGetCustomer(userId, user.email, user.name);

        // Criar sessao de checkout
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: this.priceId,
                quantity: 1
            }],
            metadata: {
                user_id: userId.toString(),
                client_id: clientId ? clientId.toString() : '',
                type: 'whatsapp_instance'
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            locale: 'pt-BR',
            billing_address_collection: 'auto',
            allow_promotion_codes: true
        });

        logger.info('Stripe checkout session created', {
            userId,
            clientId,
            sessionId: session.id
        });

        return session;
    }

    /**
     * Cria sessao do portal de billing do Stripe
     */
    async createBillingPortalSession(customerId, returnUrl) {
        if (!this.isConfigured()) {
            throw new Error('Stripe nao configurado');
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl
        });

        return session;
    }

    /**
     * Cancela item de subscription (instancia WhatsApp)
     */
    async cancelSubscriptionItem(subscriptionItemId) {
        if (!this.isConfigured()) {
            throw new Error('Stripe nao configurado');
        }

        try {
            await stripe.subscriptionItems.del(subscriptionItemId);
            logger.info('Stripe subscription item cancelled', { subscriptionItemId });
            return true;
        } catch (error) {
            logger.error('Error cancelling subscription item', {
                subscriptionItemId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Lista faturas do customer
     */
    async listInvoices(customerId, limit = 10) {
        if (!this.isConfigured()) {
            throw new Error('Stripe nao configurado');
        }

        const invoices = await stripe.invoices.list({
            customer: customerId,
            limit
        });

        return invoices.data.map(invoice => ({
            id: invoice.id,
            number: invoice.number,
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            status: invoice.status,
            paid: invoice.paid,
            created: new Date(invoice.created * 1000),
            period_start: new Date(invoice.period_start * 1000),
            period_end: new Date(invoice.period_end * 1000),
            invoice_pdf: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url
        }));
    }

    /**
     * Verifica assinatura do webhook
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.isConfigured()) {
            throw new Error('Stripe nao configurado');
        }

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error('Webhook secret nao configurado');
        }

        return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }

    /**
     * Processa eventos do webhook do Stripe
     */
    async handleWebhookEvent(event) {
        logger.info('Processing Stripe webhook event', { type: event.type, id: event.id });

        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object);
                break;

            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event.data.object);
                break;

            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event.data.object);
                break;

            case 'invoice.paid':
                await this.handleInvoicePaid(event.data.object);
                break;

            default:
                logger.info('Unhandled Stripe event type', { type: event.type });
        }
    }

    /**
     * Processa checkout completado - criar instancia WhatsApp
     */
    async handleCheckoutCompleted(session) {
        const metadata = session.metadata || {};
        const userId = parseInt(metadata.user_id);
        const clientId = metadata.client_id ? parseInt(metadata.client_id) : null;

        if (!userId || metadata.type !== 'whatsapp_instance') {
            logger.warn('Invalid checkout session metadata', { metadata });
            return;
        }

        logger.info('Checkout completed, creating WhatsApp instance', {
            userId,
            clientId,
            sessionId: session.id
        });

        // Buscar subscription para obter o item ID
        let subscriptionItemId = null;
        if (session.subscription) {
            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                if (subscription.items && subscription.items.data.length > 0) {
                    subscriptionItemId = subscription.items.data[0].id;
                }
            } catch (error) {
                logger.error('Error retrieving subscription', { error: error.message });
            }
        }

        // Gerar nome unico para a instancia
        const instanceName = `opinaja-${userId}-${Date.now()}`;

        // Criar instancia no banco (UAZAPI sera criada quando usuario clicar em conectar)
        try {
            const instance = await db.createWhatsAppInstance(userId, {
                client_id: clientId,
                instance_name: instanceName,
                is_free: false,
                stripe_subscription_item_id: subscriptionItemId,
                status: 'pending' // Pendente ate criar na UAZAPI
            });

            logger.info('WhatsApp instance created after checkout', {
                userId,
                clientId,
                instanceId: instance.id,
                instanceName
            });
        } catch (error) {
            logger.error('Error creating WhatsApp instance after checkout', {
                userId,
                clientId,
                error: error.message
            });
        }
    }

    /**
     * Processa subscription cancelada - desativar instancia
     */
    async handleSubscriptionDeleted(subscription) {
        const subscriptionItemId = subscription.items?.data?.[0]?.id;

        if (!subscriptionItemId) {
            logger.warn('No subscription item ID found in deleted subscription');
            return;
        }

        // Buscar instancia pelo subscription item ID
        // Nota: precisamos adicionar uma funcao no db para isso
        logger.info('Subscription deleted, should deactivate instance', {
            subscriptionId: subscription.id,
            subscriptionItemId
        });

        // Por enquanto, apenas logar - a instancia continuara funcionando
        // ate que implementemos a desativacao automatica
    }

    /**
     * Processa atualizacao de subscription
     */
    async handleSubscriptionUpdated(subscription) {
        logger.info('Subscription updated', {
            subscriptionId: subscription.id,
            status: subscription.status
        });
    }

    /**
     * Processa falha de pagamento
     */
    async handlePaymentFailed(invoice) {
        logger.warn('Payment failed', {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            attemptCount: invoice.attempt_count
        });

        // TODO: Notificar usuario por email sobre falha de pagamento
    }

    /**
     * Processa fatura paga
     */
    async handleInvoicePaid(invoice) {
        logger.info('Invoice paid', {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            amount: invoice.amount_paid / 100
        });
    }
}

module.exports = new StripeService();
