/**
 * Servico para desativar/reativar recursos do usuario
 * quando subscription expira, cancela ou e renovada
 */

const db = require('../database');
const whatsappService = require('./whatsapp-service');
const logger = require('../logger');

/**
 * Desconecta todas as instancias WhatsApp de um usuario via UAZAPI
 * @param {number} userId
 * @returns {Promise<{success: number, failed: number, total: number}>}
 */
async function disconnectUserWhatsAppInstances(userId) {
    const instances = await db.getWhatsAppInstancesByUser(userId);
    let success = 0;
    let failed = 0;

    for (const instance of instances) {
        // So tenta desconectar se tem token e esta conectado
        if (instance.instance_token &&
            (instance.status === 'open' || instance.status === 'connected')) {
            try {
                // Chama UAZAPI POST /instance/logout
                await whatsappService.disconnectInstance(instance.instance_token);

                // Atualiza status no banco
                await db.updateWhatsAppInstance(instance.id, userId, {
                    status: 'disconnected'
                });

                success++;
                logger.info('WhatsApp instance disconnected on subscription end', {
                    userId,
                    instanceId: instance.id,
                    instanceName: instance.instance_name
                });
            } catch (error) {
                failed++;
                logger.error('Failed to disconnect WhatsApp instance', {
                    userId,
                    instanceId: instance.id,
                    error: error.message
                });

                // Marca como 'expired' mesmo se falhar a desconexao na API
                try {
                    await db.updateWhatsAppInstance(instance.id, userId, {
                        status: 'expired'
                    });
                } catch (dbError) {
                    logger.error('Failed to update instance status', {
                        instanceId: instance.id,
                        error: dbError.message
                    });
                }
            }
        } else if (instance.status !== 'disconnected' && instance.status !== 'expired') {
            // Marca instancias nao conectadas como expired
            try {
                await db.updateWhatsAppInstance(instance.id, userId, {
                    status: 'expired'
                });
            } catch (error) {
                logger.error('Failed to mark instance as expired', {
                    instanceId: instance.id,
                    error: error.message
                });
            }
        }
    }

    return { success, failed, total: instances.length };
}

/**
 * Desativa todos os clientes de um usuario (review pages ficam indisponiveis)
 * @param {number} userId
 */
async function disableUserClients(userId) {
    await db.setClientsActiveByUserId(userId, false);
    logger.info('User clients disabled', { userId });
}

/**
 * Reativa todos os clientes de um usuario
 * @param {number} userId
 */
async function enableUserClients(userId) {
    await db.setClientsActiveByUserId(userId, true);
    logger.info('User clients enabled', { userId });
}

/**
 * Desativacao completa quando subscription expira/cancela
 * @param {number} userId
 * @param {string} reason - 'trial_expired', 'subscription_canceled', 'payment_failed'
 */
async function deactivateUserResources(userId, reason) {
    logger.info('Deactivating user resources', { userId, reason });

    try {
        // 1. Desconecta instancias WhatsApp via UAZAPI
        const whatsappResult = await disconnectUserWhatsAppInstances(userId);

        // 2. Desativa paginas de review dos clientes
        await disableUserClients(userId);

        // 3. Busca info do usuario para notificacao
        const user = await db.getUserById(userId);

        // 4. Envia email de notificacao
        if (user && user.email) {
            try {
                const emailService = require('./email-service');
                if (emailService.sendServicesDeactivatedEmail) {
                    await emailService.sendServicesDeactivatedEmail(user.email, user.name, reason);
                }
            } catch (emailError) {
                logger.error('Failed to send deactivation email', {
                    userId,
                    error: emailError.message
                });
            }
        }

        // 5. Registra evento no historico
        await db.logSubscriptionEvent(userId, `resources_deactivated_${reason}`, {
            whatsapp_instances: whatsappResult,
            clients_disabled: true,
            deactivated_at: new Date().toISOString()
        });

        logger.info('User resources deactivated successfully', {
            userId,
            reason,
            whatsappInstances: whatsappResult
        });

        return {
            success: true,
            whatsappInstances: whatsappResult
        };
    } catch (error) {
        logger.error('Failed to deactivate user resources', {
            userId,
            reason,
            error: error.message
        });
        throw error;
    }
}

/**
 * Reativa recursos do usuario quando subscription e renovada
 * @param {number} userId
 */
async function reactivateUserResources(userId) {
    logger.info('Reactivating user resources', { userId });

    try {
        // Reativa paginas de review dos clientes
        await enableUserClients(userId);

        // Marca instancias WhatsApp como 'pending' (usuario precisa reconectar manualmente)
        await db.updateWhatsAppInstancesStatusByUser(userId, 'pending');

        // Registra evento
        await db.logSubscriptionEvent(userId, 'resources_reactivated', {
            reactivated_at: new Date().toISOString()
        });

        logger.info('User resources reactivated successfully', { userId });

        return { success: true };
    } catch (error) {
        logger.error('Failed to reactivate user resources', {
            userId,
            error: error.message
        });
        throw error;
    }
}

module.exports = {
    disconnectUserWhatsAppInstances,
    disableUserClients,
    enableUserClients,
    deactivateUserResources,
    reactivateUserResources
};
