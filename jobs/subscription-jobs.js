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
                    if (emailService.sendTrialReminder) {
                        await emailService.sendTrialReminder(user.email, user.name, 3);
                        await db.markTrialReminderSent(user.id, 3);
                        logger.info('Trial reminder sent (3 days)', { userId: user.id });
                    }
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
                    if (emailService.sendTrialReminder) {
                        await emailService.sendTrialReminder(user.email, user.name, 1);
                        await db.markTrialReminderSent(user.id, 1);
                        logger.info('Trial reminder sent (1 day)', { userId: user.id });
                    }
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
 * Desativa WhatsApp e paginas de review quando trial expira
 */
async function processExpiredTrials() {
    logger.info('Starting expired trials job');
    const deactivationService = require('../services/subscription-deactivation-service');

    try {
        const expiredUsers = await db.getUsersWithExpiredTrial();

        for (const user of expiredUsers) {
            try {
                // Atualiza status para expired
                await db.updateSubscriptionStatus(user.id, 'expired');
                await db.logSubscriptionEvent(user.id, 'trial_expired', {
                    ended_at: user.subscription_ends_at
                });

                // Desativa recursos do usuario (WhatsApp + clientes)
                await deactivationService.deactivateUserResources(user.id, 'trial_expired');

                logger.info('Trial expired and resources deactivated', { userId: user.id });
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

        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        let synced = 0;

        for (const user of result.rows) {
            try {
                // Verificar status no Stripe
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
