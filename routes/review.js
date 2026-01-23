const express = require('express');
const path = require('path');
const db = require('../database');
const whatsappService = require('../services/whatsapp-service');
const logger = require('../logger');

const router = express.Router();

// Get review page data
router.get('/:slug', async (req, res) => {
    try {
        const client = await db.getClientBySlug(req.params.slug);
        if (!client) {
            return res.status(404).send('Página não encontrada');
        }
        res.sendFile(path.join(__dirname, '..', 'views', 'review.html'));
    } catch (error) {
        res.status(500).send('Erro interno');
    }
});

// Get client data for review page
router.get('/:slug/data', async (req, res) => {
    try {
        const client = await db.getClientBySlug(req.params.slug);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Buscar tópicos ativos
        const topics = await db.getTopicsByClientId(client.id);

        // Buscar filiais ativas
        const branches = await db.getBranchesByClientId(client.id);
        const activeBranches = branches.filter(b => b.active === 1);

        res.json({
            name: client.name,
            address: client.address,
            phone: client.phone,
            business_hours: client.business_hours,
            google_review_link: client.google_review_link,
            logo_url: client.logo_url,
            primary_color: client.primary_color,
            slug: client.slug,
            topics: topics,
            branches: activeBranches
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

// Submit complaint
router.post('/:slug/complaint', async (req, res) => {
    try {
        const client = await db.getClientBySlug(req.params.slug);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        const { name, email, phone, complaint, topic_id, topic_name, branch_id } = req.body;

        if (!name || !email || !phone || !complaint) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        await db.createComplaint(client.id, { name, email, phone, complaint, topic_id, topic_name, branch_id });

        // Buscar dados da filial se informada
        const branch = branch_id ? await db.getBranchById(branch_id, client.id) : null;

        logger.info('New complaint received', { clientId: client.id, clientName: client.name, customerName: name, topic: topic_name, branchId: branch_id, branchName: branch?.name });

        const integrations = await db.getIntegrationsByUserId(client.user_id);

        // Log detalhado para debug de notificações
        logger.info('Checking WhatsApp notification conditions', {
            hasIntegrations: !!integrations,
            hasToken: !!integrations?.whatsapp_token,
            status: integrations?.whatsapp_status,
            hasMessage: !!integrations?.whatsapp_message,
            hasJid: !!integrations?.whatsapp_send_to_jid,
            jid: integrations?.whatsapp_send_to_jid,
            notifyNewComplaint: integrations?.whatsapp_notify_new_complaint
        });

        // Verificar se notificações de nova reclamação estão habilitadas (padrão: habilitado)
        const notifyNewComplaint = integrations?.whatsapp_notify_new_complaint !== 0;

        if (integrations && integrations.whatsapp_token &&
            (integrations.whatsapp_status === 'open' || integrations.whatsapp_status === 'connected') &&
            integrations.whatsapp_message && integrations.whatsapp_send_to_jid &&
            notifyNewComplaint) {

            logger.info('WhatsApp notification conditions met, sending message...');

            try {
                const message = whatsappService.replaceMessageVariables(integrations.whatsapp_message, {
                    clientName: client.name,
                    branchName: branch?.name || 'Sede Principal',
                    customerName: name,
                    customerEmail: email,
                    customerPhone: phone,
                    topicName: topic_name || 'Não especificado',
                    complaintText: complaint
                });

                logger.info('Sending WhatsApp message', { to: integrations.whatsapp_send_to_jid });

                const result = await whatsappService.sendTextMessage(
                    integrations.whatsapp_token,
                    integrations.whatsapp_send_to_jid,
                    message
                );

                logger.info('WhatsApp notification sent', { clientId: client.id, userId: client.user_id, result });
            } catch (whatsappError) {
                logger.error('WhatsApp notification error', {
                    clientId: client.id,
                    userId: client.user_id,
                    error: whatsappError.message,
                    stack: whatsappError.stack
                });
            }
        } else {
            logger.info('WhatsApp notification skipped - conditions not met');
        }

        if (integrations && integrations.webhook_url) {
            try {
                const webhookData = {
                    test: false,
                    timestamp: new Date().toISOString(),
                    client_id: client.id,
                    client_name: client.name,
                    branch_id: branch_id || null,
                    branch_name: branch?.name || null,
                    customer_name: name,
                    customer_email: email,
                    customer_phone: phone,
                    complaint_text: complaint,
                    topic_name: topic_name || null
                };

                const headers = { 'Content-Type': 'application/json' };
                if (integrations.webhook_header) {
                    headers['Authorization'] = integrations.webhook_header;
                }

                await fetch(integrations.webhook_url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(webhookData)
                });

                logger.info('Webhook notification sent', { clientId: client.id, userId: client.user_id });
            } catch (webhookError) {
                logger.error('Webhook notification error', {
                    clientId: client.id,
                    userId: client.user_id,
                    error: webhookError.message
                });
            }
        }

        res.json({ success: true, message: 'Sua mensagem foi enviada com sucesso!' });
    } catch (error) {
        logger.error('Complaint error', { slug: req.params.slug, error: error.message });
        res.status(500).json({ error: 'Erro ao enviar reclamação' });
    }
});

module.exports = router;
