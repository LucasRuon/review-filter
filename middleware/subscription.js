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
                hasAccess = sub.isActive && sub.plan === 'pro';
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
