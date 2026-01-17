require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./database');
const logger = require('./logger');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const reviewRoutes = require('./routes/review');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.req(req, res.statusCode);
        if (duration > 2000) {
            logger.warn(`Slow request: ${req.path}`, { duration: `${duration}ms` });
        }
    });
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/r', reviewRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// API routes for integrations
app.get('/api/integrations', require('./middleware/auth').authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);
        res.json(integrations || {});
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar integrações' });
    }
});

app.put('/api/integrations', require('./middleware/auth').authMiddleware, async (req, res) => {
    try {
        const result = await db.updateIntegrations(req.userId, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar integrações' });
    }
});

app.post('/api/integrations/test-webhook', require('./middleware/auth').authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);
        if (!integrations || !integrations.webhook_url) {
            return res.status(400).json({ error: 'Webhook não configurado' });
        }

        const testData = {
            test: true,
            timestamp: new Date().toISOString(),
            message: 'Teste de webhook do Opina Já!'
        };

        const headers = { 'Content-Type': 'application/json' };
        if (integrations.webhook_header) {
            headers['Authorization'] = integrations.webhook_header;
        }

        const response = await fetch(integrations.webhook_url, {
            method: 'POST',
            headers,
            body: JSON.stringify(testData)
        });

        if (response.ok) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: `Webhook retornou status ${response.status}` });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao testar webhook: ' + error.message });
    }
});

// API route for all complaints
app.get('/api/complaints', require('./middleware/auth').authMiddleware, async (req, res) => {
    try {
        const complaints = await db.getAllComplaintsByUserId(req.userId);
        res.json(complaints);
    } catch (error) {
        logger.error('Get all complaints error', { userId: req.userId, error: error.message });
        res.status(500).json({ error: 'Erro ao buscar reclamações' });
    }
});

// Webhook endpoint for WhatsApp events (validado por token da instância)
app.post('/api/whatsapp-webhook/:userId', express.json(), async (req, res) => {
    try {
        const { userId } = req.params;
        const event = req.body;

        // Validar que o usuário existe e tem integração configurada
        const integrations = await db.getIntegrationsByUserId(parseInt(userId));
        if (!integrations || !integrations.whatsapp_token) {
            logger.warn('WhatsApp webhook received for user without integration', { userId });
            return res.status(404).json({ error: 'Integração não encontrada' });
        }

        logger.info('WhatsApp webhook received', { userId, event: event.event });

        if (event.event === 'connection' && event.data) {
            const state = event.data.state;
            await db.updateIntegrations(parseInt(userId), {
                whatsapp_status: state
            });
            logger.info('WhatsApp connection state updated', { userId, state });
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('WhatsApp webhook error', { error: error.message });
        res.status(500).json({ error: 'Erro ao processar webhook' });
    }
});

// Custom domain middleware - check if request is from a custom domain
app.use(async (req, res, next) => {
    const host = req.hostname;
    // Skip if it's the main domain or localhost
    if (host === 'localhost' || host.includes('railway.app') || host.includes('127.0.0.1')) {
        return next();
    }

    // Check if there's a client with this custom domain
    const client = await db.getClientByCustomDomain(host);
    if (client) {
        req.customDomainClient = client;
        return res.sendFile(path.join(__dirname, 'views', 'review.html'));
    }
    next();
});

// Custom domain data endpoint
app.get('/custom-domain-data', async (req, res) => {
    const host = req.hostname;
    const client = await db.getClientByCustomDomain(host);
    if (client) {
        const topics = await db.getTopicsByClientId(client.id);
        const branches = await db.getBranchesByClientId(client.id);
        const activeBranches = branches.filter(b => b.active === 1);
        return res.json({
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
    }
    res.status(404).json({ error: 'Domínio não configurado' });
});

// Custom domain complaint endpoint
app.post('/custom-domain-complaint', async (req, res) => {
    const host = req.hostname;
    const client = await db.getClientByCustomDomain(host);
    if (!client) {
        return res.status(404).json({ error: 'Domínio não configurado' });
    }

    const { name, email, phone, complaint, topic_id, topic_name } = req.body;
    if (!name || !email || !phone || !complaint) {
        return res.status(400).json({ error: 'Preencha todos os campos' });
    }

    await db.createComplaint(client.id, { name, email, phone, complaint, topic_id, topic_name });
    res.json({ success: true, message: 'Sua mensagem foi enviada com sucesso!' });
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'terms.html'));
});

// SPA - Todas as rotas autenticadas vão para app.html
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/clients', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/clients/new', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/clients/:id/edit', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/clients/:id/complaints', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/clients/:id/topics', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/clients/:id/branches', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/integrations', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/complaints', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

// SPA Templates - retorna apenas o conteúdo interno
app.get('/spa/:page', (req, res) => {
    const page = req.params.page;
    const validPages = ['dashboard', 'clients', 'client-form', 'client-topics', 'client-branches', 'client-complaints', 'all-complaints', 'integrations', 'profile'];

    if (!validPages.includes(page)) {
        return res.status(404).send('Page not found');
    }

    res.sendFile(path.join(__dirname, 'views', 'spa', `${page}.html`));
});

// Initialize database and start server
db.init().then(() => {
    logger.info('Database initialized');
    app.listen(PORT, () => {
        logger.info('='.repeat(50));
        logger.info('Opina Já! Server started successfully');
        logger.info(`URL: http://localhost:${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info('='.repeat(50));
    });
}).catch(err => {
    logger.error('Failed to initialize database', { error: err.message });
    process.exit(1);
});
