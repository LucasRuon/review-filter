require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const db = require('./database');
const logger = require('./logger');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const reviewRoutes = require('./routes/review');
const whatsappRoutes = require('./routes/whatsapp');
const adminRoutes = require('./routes/admin');
const emailService = require('./services/email-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy para Railway (HTTPS termina no proxy)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware (para admin)
app.use(session({
    secret: process.env.SESSION_SECRET || 'opinaja-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

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

// Maintenance mode middleware
app.use(async (req, res, next) => {
    // Skip maintenance check for admin routes, static files, and landing page
    if (req.path.startsWith('/admin') ||
        req.path.startsWith('/css') ||
        req.path.startsWith('/js') ||
        req.path.startsWith('/api/support-info') ||
        req.path === '/' ||
        req.path === '/privacy' ||
        req.path === '/terms') {
        return next();
    }

    try {
        const maintenanceMode = await db.getPlatformSetting('maintenance_mode');
        if (maintenanceMode === 'true') {
            // Return maintenance page for HTML requests
            if (req.accepts('html')) {
                return res.status(503).send(`
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Manutenção - Opina Já!</title>
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
                                color: white;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                text-align: center;
                                padding: 2rem;
                            }
                            .container { max-width: 500px; }
                            .icon { font-size: 4rem; margin-bottom: 1.5rem; }
                            h1 { font-size: 2rem; margin-bottom: 1rem; }
                            p { color: rgba(255,255,255,0.7); font-size: 1.1rem; line-height: 1.6; }
                            .logo {
                                display: inline-flex;
                                align-items: center;
                                gap: 0.5rem;
                                margin-bottom: 2rem;
                            }
                            .logo-icon {
                                width: 40px; height: 40px;
                                background: #EF4444;
                                border-radius: 10px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: 800;
                            }
                            .logo-text { font-weight: 700; font-size: 1.25rem; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="logo">
                                <div class="logo-icon">OJ</div>
                                <span class="logo-text">Opina Já!</span>
                            </div>
                            <div class="icon">🔧</div>
                            <h1>Estamos em manutenção</h1>
                            <p>Estamos fazendo algumas melhorias na plataforma. Voltaremos em breve!</p>
                        </div>
                    </body>
                    </html>
                `);
            }
            // Return JSON for API requests
            return res.status(503).json({ error: 'Sistema em manutenção', maintenance: true });
        }
    } catch (error) {
        logger.error('Error checking maintenance mode', { error: error.message });
    }
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/r', reviewRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/admin', adminRoutes);

// API para informações de suporte (público)
app.get('/api/support-info', async (req, res) => {
    try {
        const whatsapp = await db.getPlatformSetting('support_whatsapp');
        const email = await db.getPlatformSetting('support_email');
        res.json({ whatsapp, email });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar informações' });
    }
});

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
app.get('/', async (req, res) => {
    try {
        const fs = require('fs');
        const whatsapp = await db.getPlatformSetting('support_whatsapp') || '5548999999999';
        let html = fs.readFileSync(path.join(__dirname, 'views', 'landing.html'), 'utf8');
        html = html.replace(/\{\{WHATSAPP_NUMBER\}\}/g, whatsapp);
        res.send(html);
    } catch (error) {
        res.sendFile(path.join(__dirname, 'views', 'landing.html'));
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
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
db.init().then(async () => {
    logger.info('Database initialized');

    // Initialize email service
    await emailService.initTransporter();

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
