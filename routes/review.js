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
            return res.status(404).send('Pagina nao encontrada');
        }
        res.sendFile(path.join(__dirname, '..', 'views', 'review.html'));
    } catch (error) {
        res.status(500).send('Erro interno');
    }
});

// Get client data for review page - OTIMIZADO: 3 queries -> 1 query
router.get('/:slug/data', async (req, res) => {
    try {
        const data = await db.getClientDataForReview(req.params.slug);
        if (!data) {
            return res.status(404).json({ error: 'Cliente nao encontrado' });
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

// Submit complaint - OTIMIZADO: notificacoes nao-bloqueantes + validacao de input
router.post('/:slug/complaint', async (req, res) => {
    try {
        const client = await db.getClientBySlug(req.params.slug);
        if (!client) {
            return res.status(404).json({ error: 'Cliente nao encontrado' });
        }

        const { name, email, phone, complaint, topic_id, topic_name, branch_id } = req.body;

        // Validação básica
        if (!name || !email || !phone || !complaint) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        // Validação de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email invalido' });
        }

        // Validação de telefone (formato brasileiro)
        const phoneClean = phone.replace(/\D/g, '');
        if (phoneClean.length < 10 || phoneClean.length > 11) {
            return res.status(400).json({ error: 'Telefone invalido' });
        }

        // Sanitização básica
        const sanitizedData = {
            name: name.trim().substring(0, 100),
            email: email.trim().toLowerCase().substring(0, 255),
            phone: phoneClean,
            complaint: complaint.trim().substring(0, 5000),
            topic_id: topic_id ? parseInt(topic_id) : null,
            topic_name: topic_name?.trim().substring(0, 100) || null,
            branch_id: branch_id ? parseInt(branch_id) : null
        };

        // Salvar reclamacao
        await db.createComplaint(client.id, sanitizedData);

        logger.info('New complaint received', { clientId: client.id, clientName: client.name, customerName: sanitizedData.name, topic: sanitizedData.topic_name, branchId: sanitizedData.branch_id });

        // CORRECAO: Responder IMEDIATAMENTE ao usuario
        res.json({ success: true, message: 'Sua mensagem foi enviada com sucesso!' });

        // CORRECAO: Processar notificacoes em background (nao bloqueia resposta)
        setImmediate(async () => {
            try {
                const branch = sanitizedData.branch_id ? await db.getBranchById(sanitizedData.branch_id, client.id) : null;
                const integrations = await db.getIntegrationsByUserId(client.user_id);

                // Verificar se notificacoes de nova reclamacao estao habilitadas
                const notifyNewComplaint = integrations?.whatsapp_notify_new_complaint !== 0;

                // WhatsApp notification
                if (integrations?.whatsapp_token &&
                    (integrations.whatsapp_status === 'open' || integrations.whatsapp_status === 'connected') &&
                    integrations.whatsapp_message && integrations.whatsapp_send_to_jid &&
                    notifyNewComplaint) {

                    const message = whatsappService.replaceMessageVariables(integrations.whatsapp_message, {
                        clientName: client.name,
                        branchName: branch?.name || 'Sede Principal',
                        customerName: sanitizedData.name,
                        customerEmail: sanitizedData.email,
                        customerPhone: sanitizedData.phone,
                        topicName: sanitizedData.topic_name || 'Nao especificado',
                        complaintText: sanitizedData.complaint
                    });

                    whatsappService.sendTextMessage(
                        integrations.whatsapp_token,
                        integrations.whatsapp_send_to_jid,
                        message
                    ).then(result => {
                        logger.info('WhatsApp notification sent (background)', { clientId: client.id, result });
                    }).catch(err => {
                        logger.error('WhatsApp notification error (background)', { clientId: client.id, error: err.message });
                    });
                }

                // Webhook notification
                if (integrations?.webhook_url) {
                    const webhookData = {
                        test: false,
                        timestamp: new Date().toISOString(),
                        client_id: client.id,
                        client_name: client.name,
                        branch_id: sanitizedData.branch_id,
                        branch_name: branch?.name || null,
                        customer_name: sanitizedData.name,
                        customer_email: sanitizedData.email,
                        customer_phone: sanitizedData.phone,
                        complaint_text: sanitizedData.complaint,
                        topic_name: sanitizedData.topic_name
                    };

                    const headers = { 'Content-Type': 'application/json' };
                    if (integrations.webhook_header) {
                        headers['Authorization'] = integrations.webhook_header;
                    }

                    fetch(integrations.webhook_url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(webhookData),
                        signal: AbortSignal.timeout(10000) // Timeout 10s
                    }).then(() => {
                        logger.info('Webhook notification sent (background)', { clientId: client.id });
                    }).catch(err => {
                        logger.error('Webhook notification error (background)', { clientId: client.id, error: err.message });
                    });
                }
            } catch (error) {
                logger.error('Background notification error', { clientId: client.id, error: error.message });
            }
        });

    } catch (error) {
        logger.error('Complaint error', { slug: req.params.slug, error: error.message });
        res.status(500).json({ error: 'Erro ao enviar reclamacao' });
    }
});

module.exports = router;
