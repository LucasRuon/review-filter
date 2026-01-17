const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const whatsappService = require('../services/whatsapp-service');
const logger = require('../logger');

const router = express.Router();

// Generate slug from name (without random suffix)
function generateSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Espaços viram hífens
        .replace(/-+/g, '-') // Remove hífens duplicados
        .replace(/^-|-$/g, ''); // Remove hífens no início/fim
}

// Check if slug exists and add number if needed
async function getUniqueSlug(name, existingSlug = null) {
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    // Check if slug already exists (excluding current client when editing)
    while (true) {
        const existing = await db.getClientBySlug(slug);
        if (!existing || (existingSlug && existing.slug === existingSlug)) {
            break;
        }
        counter++;
        slug = `${baseSlug}-${counter}`;
    }

    return slug;
}

// Get all clients
router.get('/', authMiddleware, async (req, res) => {
    try {
        const clients = await db.getClientsByUserId(req.userId);
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
});

// Get single client
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
});

// Create client
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, address, phone, google_review_link, business_hours, logo_url, primary_color, custom_domain } = req.body;

        if (!name || !address || !phone || !google_review_link || !business_hours) {
            return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
        }

        const slug = await getUniqueSlug(name);
        const result = await db.createClient(req.userId, {
            name, address, phone, google_review_link, business_hours, slug, logo_url, primary_color, custom_domain
        });

        logger.info('Client created', { userId: req.userId, clientId: result.lastInsertRowid, name, slug });
        res.json({ success: true, id: result.lastInsertRowid, slug, message: 'Cliente cadastrado com sucesso!' });
    } catch (error) {
        logger.error('Create client error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao cadastrar cliente' });
    }
});

// Update client
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, address, phone, google_review_link, business_hours, logo_url, primary_color, custom_domain } = req.body;

        if (!name || !address || !phone || !google_review_link || !business_hours) {
            return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
        }

        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        await db.updateClient(req.params.id, req.userId, {
            name, address, phone, google_review_link, business_hours, logo_url, primary_color, custom_domain
        });

        logger.info('Client updated', { userId: req.userId, clientId: req.params.id, name });
        res.json({ success: true, message: 'Cliente atualizado com sucesso!' });
    } catch (error) {
        logger.error('Update client error', { userId: req.userId, clientId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

// Delete client
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        await db.deleteClient(req.params.id, req.userId);
        logger.info('Client deleted', { userId: req.userId, clientId: req.params.id, name: client.name });
        res.json({ success: true, message: 'Cliente excluído com sucesso!' });
    } catch (error) {
        logger.error('Delete client error', { userId: req.userId, clientId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Erro ao excluir cliente' });
    }
});

// Get client complaints
router.get('/:id/complaints', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        const complaints = await db.getComplaintsByClientId(req.params.id);
        res.json({ client, complaints });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar reclamações' });
    }
});

// Update complaint status
router.put('/:clientId/complaints/:complaintId/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'in_progress', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const client = await db.getClientById(req.params.clientId, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Buscar reclamação antes de atualizar (validando que pertence ao cliente)
        const complaint = await db.getComplaintById(req.params.complaintId, req.params.clientId);
        if (!complaint) {
            return res.status(404).json({ error: 'Reclamação não encontrada' });
        }

        await db.updateComplaintStatus(req.params.complaintId, req.params.clientId, status);
        logger.info('Complaint status updated', { clientId: req.params.clientId, complaintId: req.params.complaintId, status });

        // Enviar mensagem WhatsApp se configurado
        if (complaint && (status === 'in_progress' || status === 'resolved')) {
            const integrations = await db.getIntegrationsByUserId(req.userId);

            if (integrations &&
                integrations.whatsapp_token &&
                (integrations.whatsapp_status === 'open' || integrations.whatsapp_status === 'connected') &&
                integrations.whatsapp_notify_status_change &&
                complaint.customer_phone) {

                let messageTemplate = null;

                if (status === 'in_progress' && integrations.whatsapp_message_in_progress) {
                    messageTemplate = integrations.whatsapp_message_in_progress;
                } else if (status === 'resolved' && integrations.whatsapp_message_resolved) {
                    messageTemplate = integrations.whatsapp_message_resolved;
                }

                if (messageTemplate) {
                    try {
                        const message = whatsappService.replaceMessageVariables(messageTemplate, {
                            clientName: client.name,
                            customerName: complaint.customer_name,
                            customerEmail: complaint.customer_email,
                            customerPhone: complaint.customer_phone,
                            topicName: complaint.topic_name || 'Não especificado',
                            complaintText: complaint.complaint_text
                        });

                        // Enviar para o telefone do cliente (que fez a reclamação)
                        await whatsappService.sendTextMessage(
                            integrations.whatsapp_token,
                            complaint.customer_phone,
                            message
                        );

                        logger.info('WhatsApp status notification sent to customer', {
                            clientId: req.params.clientId,
                            complaintId: req.params.complaintId,
                            status,
                            customerPhone: complaint.customer_phone
                        });
                    } catch (whatsappError) {
                        logger.error('WhatsApp status notification error', {
                            clientId: req.params.clientId,
                            complaintId: req.params.complaintId,
                            error: whatsappError.message
                        });
                    }
                }
            }
        }

        res.json({ success: true, message: 'Status atualizado!' });
    } catch (error) {
        logger.error('Update complaint status error', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Get niche templates
router.get('/templates/niches', authMiddleware, (req, res) => {
    try {
        const templates = Object.entries(db.NICHE_TEMPLATES).map(([key, value]) => ({
            id: key,
            name: value.name,
            topics: value.topics
        }));
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

// Get client topics
router.get('/:id/topics', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const topics = await db.getAllTopicsByClientId(req.params.id);
        res.json(topics);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar tópicos' });
    }
});

// Add topic
router.post('/:id/topics', authMiddleware, async (req, res) => {
    try {
        const { name, icon } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const result = await db.createTopic(req.params.id, name, icon);
        logger.info('Topic created', { clientId: req.params.id, name });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar tópico' });
    }
});

// Update topic
router.put('/:clientId/topics/:topicId', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.clientId, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        // Validar que o tópico pertence ao cliente
        const topic = await db.getTopicById(req.params.topicId, req.params.clientId);
        if (!topic) {
            return res.status(404).json({ error: 'Tópico não encontrado' });
        }
        await db.updateTopic(req.params.topicId, req.params.clientId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar tópico' });
    }
});

// Delete topic
router.delete('/:clientId/topics/:topicId', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.clientId, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        // Validar que o tópico pertence ao cliente
        const topic = await db.getTopicById(req.params.topicId, req.params.clientId);
        if (!topic) {
            return res.status(404).json({ error: 'Tópico não encontrado' });
        }
        await db.deleteTopic(req.params.topicId, req.params.clientId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir tópico' });
    }
});

// Reset topics to niche template
router.post('/:id/topics/reset', authMiddleware, async (req, res) => {
    try {
        const { niche } = req.body;
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        await db.resetTopicsToNiche(req.params.id, niche || 'general');
        logger.info('Topics reset to niche', { clientId: req.params.id, niche });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao resetar tópicos' });
    }
});

// ========== BRANCHES (Filiais) ==========

// Get branches
router.get('/:id/branches', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const branches = await db.getBranchesByClientId(req.params.id);
        res.json(branches);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar filiais' });
    }
});

// Create branch
router.post('/:id/branches', authMiddleware, async (req, res) => {
    try {
        const { name, address, phone, business_hours, is_main } = req.body;
        if (!name || !address) {
            return res.status(400).json({ error: 'Nome e endereço são obrigatórios' });
        }
        const client = await db.getClientById(req.params.id, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const result = await db.createBranch(req.params.id, { name, address, phone, business_hours, is_main });
        logger.info('Branch created', { clientId: req.params.id, name });
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar filial' });
    }
});

// Update branch
router.put('/:clientId/branches/:branchId', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.clientId, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const branch = await db.getBranchById(req.params.branchId, req.params.clientId);
        if (!branch) {
            return res.status(404).json({ error: 'Filial não encontrada' });
        }
        await db.updateBranch(req.params.branchId, req.params.clientId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar filial' });
    }
});

// Delete branch
router.delete('/:clientId/branches/:branchId', authMiddleware, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.clientId, req.userId);
        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const branch = await db.getBranchById(req.params.branchId, req.params.clientId);
        if (!branch) {
            return res.status(404).json({ error: 'Filial não encontrada' });
        }
        await db.deleteBranch(req.params.branchId, req.params.clientId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir filial' });
    }
});

module.exports = router;
