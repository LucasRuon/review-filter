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

    /**
     * Verifica se o Stripe esta minimamente configurado
     * Para checkout de planos, nao precisa do priceId de WhatsApp
     */
    isConfigured() {
        return stripe !== null;
    }

    /**
     * Verifica se o checkout de WhatsApp instance esta configurado
     */
    isWhatsAppCheckoutConfigured() {
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
     * Processa checkout completado - criar instancia WhatsApp ou ativar subscription
     */
    async handleCheckoutCompleted(session) {
        const metadata = session.metadata || {};
        const userId = parseInt(metadata.user_id);

        if (!userId) {
            logger.warn('Invalid checkout session metadata - missing user_id', { metadata });
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

        // Checkout de WhatsApp instance
        const clientId = metadata.client_id ? parseInt(metadata.client_id) : null;
        if (metadata.type !== 'whatsapp_instance') {
            logger.warn('Invalid checkout session type', { metadata });
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
            status: subscription.status,
            customerId: subscription.customer
        });

        try {
            // Buscar usuario pelo stripe_customer_id
            const userResult = await db.pool.query(
                'SELECT id FROM users WHERE stripe_customer_id = $1',
                [subscription.customer]
            );

            if (userResult.rows.length === 0) {
                logger.warn('User not found for subscription update', { customerId: subscription.customer });
                return;
            }

            const userId = userResult.rows[0].id;
            const priceId = subscription.items?.data[0]?.price?.id;
            const plan = priceId ? await this.getPlanFromPriceId(priceId) : 'pro';
            const endsAt = new Date(subscription.current_period_end * 1000);

            // Mapear status do Stripe para nosso status
            let subscriptionStatus = 'active';
            if (subscription.status === 'canceled') {
                subscriptionStatus = 'canceled';
            } else if (subscription.status === 'past_due') {
                subscriptionStatus = 'past_due';
            } else if (subscription.status === 'unpaid') {
                subscriptionStatus = 'expired';
            } else if (subscription.status === 'trialing') {
                subscriptionStatus = 'trial';
            } else if (subscription.status === 'active') {
                subscriptionStatus = 'active';
            }

            await db.pool.query(`
                UPDATE users SET
                    subscription_status = $1,
                    subscription_plan = $2,
                    stripe_subscription_id = $3,
                    subscription_ends_at = $4
                WHERE id = $5
            `, [subscriptionStatus, plan, subscription.id, endsAt, userId]);

            logger.info('User subscription updated from webhook', {
                userId,
                status: subscriptionStatus,
                plan,
                endsAt
            });

            await db.logSubscriptionEvent(userId, 'subscription_updated', {
                status: subscriptionStatus,
                plan,
                stripe_status: subscription.status,
                ends_at: endsAt.toISOString()
            });
        } catch (error) {
            logger.error('Error handling subscription updated', { error: error.message });
        }
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

        try {
            // Atualizar status do usuario para past_due
            await db.pool.query(`
                UPDATE users SET subscription_status = 'past_due'
                WHERE stripe_customer_id = $1
            `, [invoice.customer]);
        } catch (error) {
            logger.error('Error updating user status on payment failure', { error: error.message });
        }
    }

    /**
     * Processa fatura paga - atualiza subscription para active
     */
    async handleInvoicePaid(invoice) {
        logger.info('Invoice paid', {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            subscriptionId: invoice.subscription,
            amount: invoice.amount_paid / 100
        });

        try {
            // Se a fatura tem uma subscription associada, atualizar o status
            if (invoice.subscription) {
                const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                const priceId = subscription.items?.data[0]?.price?.id;
                const plan = priceId ? await this.getPlanFromPriceId(priceId) : 'pro';
                const endsAt = new Date(subscription.current_period_end * 1000);

                await db.pool.query(`
                    UPDATE users SET
                        subscription_status = 'active',
                        subscription_plan = $1,
                        stripe_subscription_id = $2,
                        subscription_ends_at = $3,
                        last_payment_at = NOW()
                    WHERE stripe_customer_id = $4
                `, [plan, invoice.subscription, endsAt, invoice.customer]);

                logger.info('User subscription activated from invoice paid', {
                    customerId: invoice.customer,
                    plan,
                    endsAt
                });
            }
        } catch (error) {
            logger.error('Error handling invoice paid', { error: error.message });
        }
    }

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
        const settings = await db.getAllPlatformSettings();

        if (priceId === settings.stripe_price_id_pro_monthly ||
            priceId === settings.stripe_price_id_pro_yearly) {
            return 'pro';
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
}

module.exports = new StripeService();
