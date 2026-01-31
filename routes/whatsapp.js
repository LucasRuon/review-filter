const express = require('express');
const db = require('../database');
const whatsappService = require('../services/whatsapp-service');
const stripeService = require('../services/stripe-service');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

// ========== ROTAS DE INSTANCIAS (NOVA ARQUITETURA) ==========

// Listar todas instancias do usuario
router.get('/instances', authMiddleware, async (req, res) => {
    try {
        // Buscar instancias do banco local
        let instances = await db.getWhatsAppInstancesByUser(req.userId);

        // Se nao tem instancias no banco, buscar da UAZAPI e sincronizar
        if (instances.length === 0) {
            try {
                const uazapiResult = await whatsappService.listAllInstances();
                const user = await db.getUserById(req.userId);

                // Filtrar instancias do usuario (pelo prefixo opinaja-{userId})
                const userInstances = (uazapiResult.instances || []).filter(inst => {
                    const name = inst.name || inst.instance?.name || '';
                    return name.startsWith(`opinaja-${req.userId}-`);
                });

                // Sincronizar com banco local
                for (const uazapiInstance of userInstances) {
                    const instanceName = uazapiInstance.name || uazapiInstance.instance?.name;
                    const instanceToken = uazapiInstance.token || uazapiInstance.instance?.token;
                    const status = uazapiInstance.status || uazapiInstance.instance?.status || 'disconnected';

                    if (instanceName && instanceToken) {
                        try {
                            await db.createWhatsAppInstance(req.userId, {
                                instance_name: instanceName,
                                instance_token: instanceToken,
                                status: status,
                                is_free: instances.length === 0 // Primeira e gratuita
                            });
                            logger.info('WhatsApp instance synced from UAZAPI', {
                                userId: req.userId,
                                instanceName
                            });
                        } catch (syncError) {
                            // Ignorar erro de duplicata
                            if (!syncError.message.includes('duplicate')) {
                                logger.warn('Error syncing instance', { error: syncError.message });
                            }
                        }
                    }
                }

                // Buscar novamente apos sincronizacao
                instances = await db.getWhatsAppInstancesByUser(req.userId);
            } catch (uazapiError) {
                logger.warn('Could not sync with UAZAPI', { error: uazapiError.message });
                // Continua mesmo sem sincronizacao
            }
        }

        const clientsWithoutInstance = await db.getClientsWithoutInstance(req.userId);
        const hasFreeInstance = await db.hasUserFreeInstance(req.userId);

        res.json({
            success: true,
            instances,
            clientsWithoutInstance,
            canCreateFree: !hasFreeInstance
        });
    } catch (error) {
        logger.error('List WhatsApp instances error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao listar instancias' });
    }
});

// Criar nova instancia
router.post('/instances', authMiddleware, async (req, res) => {
    try {
        const { clientId, createFree } = req.body;
        const user = await db.getUserById(req.userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuario nao encontrado' });
        }

        // Verificar se pode criar instancia gratuita
        const hasFreeInstance = await db.hasUserFreeInstance(req.userId);

        if (createFree && hasFreeInstance) {
            return res.status(400).json({
                error: 'Voce ja possui uma instancia gratuita. Adicione uma nova instancia paga.'
            });
        }

        // Se nao for gratuita, precisa de checkout do Stripe
        if (!createFree && hasFreeInstance) {
            if (!stripeService.isConfigured()) {
                return res.status(503).json({
                    error: 'Sistema de pagamento nao configurado. Entre em contato com o suporte.'
                });
            }

            // Retornar que precisa de checkout
            return res.json({
                success: false,
                requiresCheckout: true,
                message: 'Esta instancia requer pagamento'
            });
        }

        // Gerar nome unico para a instancia
        const instanceName = `opinaja-${req.userId}-${Date.now()}`;

        // Criar instancia na UAZAPI
        const result = await whatsappService.createInstance(instanceName);

        // Criar instancia no banco
        const instance = await db.createWhatsAppInstance(req.userId, {
            client_id: clientId || null,
            instance_name: result.instanceName,
            instance_token: result.token,
            is_free: !hasFreeInstance, // Primeira instancia e gratuita
            status: 'disconnected'
        });

        logger.info('WhatsApp instance created', {
            userId: req.userId,
            instanceId: instance.id,
            instanceName: result.instanceName,
            isFree: !hasFreeInstance
        });

        res.json({
            success: true,
            instance: {
                ...instance,
                client_name: null // Sera preenchido quando vincular
            }
        });
    } catch (error) {
        logger.error('Create WhatsApp instance error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao criar instancia' });
    }
});

// Obter detalhes de uma instancia
router.get('/instances/:id', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        res.json({
            success: true,
            instance
        });
    } catch (error) {
        logger.error('Get WhatsApp instance error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: 'Erro ao buscar instancia' });
    }
});

// Atualizar instancia (vincular cliente, configurar mensagens, etc)
router.put('/instances/:id', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        const updateData = {};
        const allowedFields = [
            'client_id',
            'send_to_type',
            'send_to_jid',
            'message_new_complaint',
            'message_in_progress',
            'message_resolved',
            'notify_new_complaint',
            'notify_status_change'
        ];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Se estiver vinculando a um cliente, verificar se o cliente pertence ao usuario
        if (updateData.client_id) {
            const client = await db.getClientById(updateData.client_id, req.userId);
            if (!client) {
                return res.status(400).json({ error: 'Cliente nao encontrado' });
            }

            // Verificar se o cliente ja tem outra instancia
            const existingInstance = await db.getWhatsAppInstanceByClient(updateData.client_id);
            if (existingInstance && existingInstance.id !== parseInt(req.params.id)) {
                return res.status(400).json({
                    error: 'Este cliente ja possui uma instancia WhatsApp vinculada'
                });
            }
        }

        const updated = await db.updateWhatsAppInstance(req.params.id, req.userId, updateData);

        logger.info('WhatsApp instance updated', {
            userId: req.userId,
            instanceId: req.params.id,
            updates: Object.keys(updateData)
        });

        res.json({
            success: true,
            instance: updated
        });
    } catch (error) {
        logger.error('Update WhatsApp instance error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: 'Erro ao atualizar instancia' });
    }
});

// Deletar instancia
router.delete('/instances/:id', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        // Deletar na UAZAPI se tiver token
        if (instance.instance_token) {
            try {
                await whatsappService.deleteInstance(instance.instance_token);
            } catch (err) {
                logger.warn('Error deleting UAZAPI instance', {
                    instanceId: req.params.id,
                    error: err.message
                });
            }
        }

        // Cancelar subscription no Stripe se nao for gratuita
        if (!instance.is_free && instance.stripe_subscription_item_id) {
            try {
                await stripeService.cancelSubscriptionItem(instance.stripe_subscription_item_id);
            } catch (err) {
                logger.warn('Error cancelling Stripe subscription', {
                    instanceId: req.params.id,
                    error: err.message
                });
            }
        }

        // Deletar no banco
        await db.deleteWhatsAppInstance(req.params.id, req.userId);

        logger.info('WhatsApp instance deleted', {
            userId: req.userId,
            instanceId: req.params.id,
            wasFree: instance.is_free
        });

        res.json({ success: true, message: 'Instancia removida com sucesso' });
    } catch (error) {
        logger.error('Delete WhatsApp instance error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: 'Erro ao remover instancia' });
    }
});

// Conectar instancia (gerar QR Code)
router.post('/instances/:id/connect', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        // Se a instancia ainda nao foi criada na UAZAPI (status = pending)
        if (instance.status === 'pending' || !instance.instance_token) {
            // Criar instancia na UAZAPI
            const instanceName = instance.instance_name || `opinaja-${req.userId}-${Date.now()}`;
            const createResult = await whatsappService.createInstance(instanceName);

            await db.updateWhatsAppInstance(req.params.id, req.userId, {
                instance_name: createResult.instanceName,
                instance_token: createResult.token,
                status: 'disconnected'
            });

            instance.instance_token = createResult.token;
            instance.instance_name = createResult.instanceName;
        }

        // Conectar na UAZAPI
        const result = await whatsappService.connectInstance(instance.instance_token);

        // Atualizar status no banco
        await db.updateWhatsAppInstance(req.params.id, req.userId, {
            qrcode: result.qrcode || result.paircode,
            status: result.state || 'connecting'
        });

        res.json({
            success: true,
            qrcode: result.qrcode,
            paircode: result.paircode,
            state: result.state,
            alreadyConnected: result.alreadyConnected
        });
    } catch (error) {
        logger.error('Connect WhatsApp instance error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao conectar instancia' });
    }
});

// Obter status da instancia
router.get('/instances/:id/status', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        if (!instance.instance_token) {
            return res.json({
                success: true,
                connected: false,
                state: 'pending'
            });
        }

        const result = await whatsappService.getInstanceStatus(instance.instance_token);

        // Atualizar status no banco
        await db.updateWhatsAppInstance(req.params.id, req.userId, {
            status: result.state
        });

        res.json({
            success: true,
            connected: result.connected,
            state: result.state
        });
    } catch (error) {
        logger.error('WhatsApp instance status error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao verificar status' });
    }
});

// Desconectar instancia (logout, mantem instancia)
router.post('/instances/:id/disconnect', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        if (!instance.instance_token) {
            return res.status(400).json({ error: 'Instancia nao possui token' });
        }

        await whatsappService.disconnectInstance(instance.instance_token);

        await db.updateWhatsAppInstance(req.params.id, req.userId, {
            status: 'disconnected',
            qrcode: null
        });

        logger.info('WhatsApp instance disconnected', {
            userId: req.userId,
            instanceId: req.params.id
        });

        res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    } catch (error) {
        logger.error('Disconnect WhatsApp instance error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao desconectar' });
    }
});

// Enviar mensagem de teste
router.post('/instances/:id/send-test', authMiddleware, async (req, res) => {
    try {
        const { number, message } = req.body;
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        if (!instance.instance_token) {
            return res.status(400).json({ error: 'Instancia nao conectada' });
        }

        if (!number || !message) {
            return res.status(400).json({ error: 'Numero e mensagem sao obrigatorios' });
        }

        const result = await whatsappService.sendTextMessage(instance.instance_token, number, message);

        logger.info('WhatsApp test message sent', {
            userId: req.userId,
            instanceId: req.params.id,
            number
        });

        res.json({
            success: true,
            messageId: result.messageId
        });
    } catch (error) {
        logger.error('Send WhatsApp test message error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao enviar mensagem' });
    }
});

// Listar grupos da instancia
router.get('/instances/:id/groups', authMiddleware, async (req, res) => {
    try {
        const instance = await db.getWhatsAppInstanceById(req.params.id, req.userId);

        if (!instance) {
            return res.status(404).json({ error: 'Instancia nao encontrada' });
        }

        if (!instance.instance_token) {
            return res.status(400).json({ error: 'Instancia nao conectada' });
        }

        const result = await whatsappService.listGroups(instance.instance_token);

        res.json({
            success: true,
            groups: result.groups
        });
    } catch (error) {
        logger.error('List WhatsApp groups error', {
            userId: req.userId,
            instanceId: req.params.id,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao listar grupos' });
    }
});

// ========== ROTAS LEGACY (COMPATIBILIDADE) ==========
// Essas rotas mantem compatibilidade com o frontend antigo
// ate que seja atualizado para usar as novas rotas

router.post('/instance/create', authMiddleware, async (req, res) => {
    try {
        const user = await db.getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario nao encontrado' });
        }

        // Verificar se ja tem alguma instancia
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length > 0) {
            // Retornar a primeira instancia existente
            const instance = instances[0];
            return res.json({
                success: true,
                token: instance.instance_token,
                instanceName: instance.instance_name,
                message: 'Instancia ja existe'
            });
        }

        // Criar nova instancia
        const instanceName = `opinaja-${req.userId}-${Date.now()}`;
        const result = await whatsappService.createInstance(instanceName);

        // Salvar no novo formato
        const instance = await db.createWhatsAppInstance(req.userId, {
            instance_name: result.instanceName,
            instance_token: result.token,
            is_free: true,
            status: 'disconnected'
        });

        logger.info('WhatsApp instance created (legacy)', {
            userId: req.userId,
            instanceName: result.instanceName
        });

        res.json({
            success: true,
            token: result.token,
            instanceName: result.instanceName
        });
    } catch (error) {
        logger.error('Create WhatsApp instance error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao criar instancia WhatsApp' });
    }
});

router.post('/instance/connect', authMiddleware, async (req, res) => {
    try {
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0) {
            return res.status(400).json({ error: 'Instancia nao criada. Crie primeiro.' });
        }

        const instance = instances[0];

        if (!instance.instance_token) {
            return res.status(400).json({ error: 'Instancia sem token' });
        }

        const result = await whatsappService.connectInstance(instance.instance_token);

        await db.updateWhatsAppInstance(instance.id, req.userId, {
            qrcode: result.qrcode || result.paircode,
            status: result.state || 'connecting'
        });

        res.json({
            success: true,
            qrcode: result.qrcode,
            paircode: result.paircode,
            state: result.state
        });
    } catch (error) {
        logger.error('Connect WhatsApp instance error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao conectar instancia WhatsApp' });
    }
});

router.get('/instance/status', authMiddleware, async (req, res) => {
    try {
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0 || !instances[0].instance_token) {
            return res.json({ connected: false, state: 'disconnected' });
        }

        const instance = instances[0];
        const result = await whatsappService.getInstanceStatus(instance.instance_token);

        await db.updateWhatsAppInstance(instance.id, req.userId, {
            status: result.state
        });

        res.json({
            success: true,
            connected: result.connected,
            state: result.state
        });
    } catch (error) {
        logger.error('WhatsApp instance status error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao verificar status' });
    }
});

router.post('/instance/disconnect', authMiddleware, async (req, res) => {
    try {
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0 || !instances[0].instance_token) {
            return res.status(400).json({ error: 'Nenhuma instancia encontrada' });
        }

        const instance = instances[0];
        await whatsappService.disconnectInstance(instance.instance_token);

        await db.updateWhatsAppInstance(instance.id, req.userId, {
            status: 'disconnected',
            qrcode: null
        });

        res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    } catch (error) {
        logger.error('Disconnect WhatsApp instance error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao desconectar WhatsApp' });
    }
});

router.delete('/instance', authMiddleware, async (req, res) => {
    try {
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0 || !instances[0].instance_token) {
            return res.status(400).json({ error: 'Nenhuma instancia encontrada' });
        }

        const instance = instances[0];
        await whatsappService.deleteInstance(instance.instance_token);

        await db.deleteWhatsAppInstance(instance.id, req.userId);

        res.json({ success: true, message: 'Instancia removida completamente' });
    } catch (error) {
        logger.error('Delete WhatsApp instance error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao deletar instancia' });
    }
});

router.get('/groups', authMiddleware, async (req, res) => {
    try {
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0 || !instances[0].instance_token) {
            return res.status(400).json({ error: 'WhatsApp nao conectado' });
        }

        const result = await whatsappService.listGroups(instances[0].instance_token);

        res.json({
            success: true,
            groups: result.groups
        });
    } catch (error) {
        logger.error('List WhatsApp groups error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao listar grupos' });
    }
});

router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { number, message } = req.body;
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0 || !instances[0].instance_token) {
            return res.status(400).json({ error: 'WhatsApp nao conectado' });
        }

        if (!number || !message) {
            return res.status(400).json({ error: 'Numero e mensagem sao obrigatorios' });
        }

        const result = await whatsappService.sendTextMessage(instances[0].instance_token, number, message);

        res.json({
            success: true,
            messageId: result.messageId
        });
    } catch (error) {
        logger.error('Send WhatsApp message error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: error.message || 'Erro ao enviar mensagem' });
    }
});

router.put('/config', authMiddleware, async (req, res) => {
    try {
        const instances = await db.getWhatsAppInstancesByUser(req.userId);

        if (instances.length === 0) {
            return res.status(400).json({ error: 'Nenhuma instancia encontrada' });
        }

        const instance = instances[0];

        const {
            whatsapp_message,
            whatsapp_send_to_type,
            whatsapp_send_to_jid,
            whatsapp_notify_new_complaint,
            whatsapp_notify_status_change,
            whatsapp_message_in_progress,
            whatsapp_message_resolved
        } = req.body;

        await db.updateWhatsAppInstance(instance.id, req.userId, {
            message_new_complaint: whatsapp_message,
            send_to_type: whatsapp_send_to_type,
            send_to_jid: whatsapp_send_to_jid,
            notify_new_complaint: whatsapp_notify_new_complaint,
            notify_status_change: whatsapp_notify_status_change,
            message_in_progress: whatsapp_message_in_progress,
            message_resolved: whatsapp_message_resolved
        });

        logger.info('WhatsApp config updated (legacy)', {
            userId: req.userId,
            instanceId: instance.id
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Update WhatsApp config error (legacy)', {
            userId: req.userId,
            error: error.message
        });
        res.status(500).json({ error: 'Erro ao salvar configuracoes' });
    }
});

module.exports = router;
