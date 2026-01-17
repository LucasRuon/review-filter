const express = require('express');
const db = require('../database');
const whatsappService = require('../services/whatsapp-service');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

router.post('/instance/create', authMiddleware, async (req, res) => {
    try {
        const user = await db.getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (!user.phone) {
            return res.status(400).json({ error: 'Telefone não cadastrado. Atualize seu perfil primeiro.' });
        }

        // Verificar se já existe uma instância ativa
        const existingIntegrations = await db.getIntegrationsByUserId(req.userId);
        if (existingIntegrations && existingIntegrations.whatsapp_token) {
            logger.info('WhatsApp instance already exists, reusing', { userId: req.userId });
            return res.json({
                success: true,
                token: existingIntegrations.whatsapp_token,
                instanceName: existingIntegrations.whatsapp_instance_name,
                message: 'Instância já existe'
            });
        }

        const instanceName = `opinaja-${req.userId}-${Date.now()}`;
        const result = await whatsappService.createInstance(instanceName);

        await db.updateIntegrations(req.userId, {
            whatsapp_instance_name: result.instanceName,
            whatsapp_token: result.token,
            whatsapp_status: 'disconnected'
        });

        logger.info('WhatsApp instance created', { userId: req.userId, instanceName: result.instanceName });
        res.json({
            success: true,
            token: result.token,
            instanceName: result.instanceName
        });
    } catch (error) {
        logger.error('Create WhatsApp instance error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao criar instância WhatsApp' });
    }
});

router.post('/instance/connect', authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);

        if (!integrations || !integrations.whatsapp_token) {
            return res.status(400).json({ error: 'Instância não criada. Crie primeiro.' });
        }

        const result = await whatsappService.connectInstance(integrations.whatsapp_token);

        await db.updateIntegrations(req.userId, {
            whatsapp_qrcode: result.qrcode || result.paircode,
            whatsapp_status: result.state || 'connecting'
        });

        const responseData = {
            success: true,
            qrcode: result.qrcode,
            paircode: result.paircode,
            state: result.state
        };

        logger.info('WhatsApp instance connecting', { userId: req.userId, state: result.state });
        res.json(responseData);
    } catch (error) {
        logger.error('Connect WhatsApp instance error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao conectar instância WhatsApp' });
    }
});

router.get('/instance/status', authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);

        if (!integrations || !integrations.whatsapp_token) {
            return res.json({ connected: false, state: 'disconnected' });
        }

        const result = await whatsappService.getInstanceStatus(integrations.whatsapp_token);

        await db.updateIntegrations(req.userId, {
            whatsapp_status: result.state
        });

        res.json({
            success: true,
            connected: result.connected,
            state: result.state
        });
    } catch (error) {
        logger.error('WhatsApp instance status error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao verificar status' });
    }
});

// Desconectar WhatsApp (logout) - mantém a instância mas desconecta
router.post('/instance/disconnect', authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);

        if (!integrations || !integrations.whatsapp_token) {
            return res.status(400).json({ error: 'Nenhuma instância encontrada' });
        }

        // Apenas desconecta (logout) sem deletar a instância
        await whatsappService.disconnectInstance(integrations.whatsapp_token);

        await db.updateIntegrations(req.userId, {
            whatsapp_status: 'disconnected',
            whatsapp_qrcode: null
        });

        logger.info('WhatsApp instance disconnected', { userId: req.userId });
        res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    } catch (error) {
        logger.error('Disconnect WhatsApp instance error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao desconectar WhatsApp' });
    }
});

// Deletar instância completamente (remove tudo)
router.delete('/instance', authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);

        if (!integrations || !integrations.whatsapp_token) {
            return res.status(400).json({ error: 'Nenhuma instância encontrada' });
        }

        await whatsappService.deleteInstance(integrations.whatsapp_token);

        await db.updateIntegrations(req.userId, {
            whatsapp_instance_name: null,
            whatsapp_token: null,
            whatsapp_status: 'disconnected',
            whatsapp_qrcode: null,
            whatsapp_send_to_jid: null,
            whatsapp_send_to_type: 'contact'
        });

        logger.info('WhatsApp instance deleted', { userId: req.userId });
        res.json({ success: true, message: 'Instância removida completamente' });
    } catch (error) {
        logger.error('Delete WhatsApp instance error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao deletar instância' });
    }
});

router.get('/groups', authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);

        if (!integrations || !integrations.whatsapp_token) {
            return res.status(400).json({ error: 'WhatsApp não conectado' });
        }

        const result = await whatsappService.listGroups(integrations.whatsapp_token);

        res.json({
            success: true,
            groups: result.groups
        });
    } catch (error) {
        logger.error('List WhatsApp groups error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao listar grupos' });
    }
});

router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { number, message } = req.body;
        const integrations = await db.getIntegrationsByUserId(req.userId);

        if (!integrations || !integrations.whatsapp_token) {
            return res.status(400).json({ error: 'WhatsApp não conectado' });
        }

        if (!number || !message) {
            return res.status(400).json({ error: 'Número e mensagem são obrigatórios' });
        }

        const result = await whatsappService.sendTextMessage(integrations.whatsapp_token, number, message);

        logger.info('WhatsApp message sent', { userId: req.userId, number });
        res.json({
            success: true,
            messageId: result.messageId
        });
    } catch (error) {
        logger.error('Send WhatsApp message error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: error.message || 'Erro ao enviar mensagem' });
    }
});

router.put('/config', authMiddleware, async (req, res) => {
    try {
        const {
            whatsapp_message,
            whatsapp_send_to_type,
            whatsapp_send_to_jid,
            whatsapp_notify_new_complaint,
            whatsapp_notify_status_change,
            whatsapp_message_in_progress,
            whatsapp_message_resolved
        } = req.body;

        const updateData = {
            whatsapp_message,
            whatsapp_send_to_type,
            whatsapp_send_to_jid,
            whatsapp_notify_new_complaint,
            whatsapp_notify_status_change,
            whatsapp_message_in_progress,
            whatsapp_message_resolved
        };

        await db.updateIntegrations(req.userId, updateData);

        logger.info('WhatsApp config updated', {
            userId: req.userId,
            type: whatsapp_send_to_type,
            jid: whatsapp_send_to_jid,
            notifyNew: whatsapp_notify_new_complaint,
            notifyStatus: whatsapp_notify_status_change
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Update WhatsApp config error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

module.exports = router;
