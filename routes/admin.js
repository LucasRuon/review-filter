const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('../database');
const logger = require('../logger');
const emailService = require('../services/email-service');

const router = express.Router();

// Middleware para verificar se é admin
function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        return res.redirect('/admin/login');
    }
    next();
}

// Middleware para logging de ações admin
async function logAction(req, action, details, targetUserId = null) {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';
        await db.createAdminLog(req.session.adminId, action, details, ip, userAgent, targetUserId);
    } catch (e) {
        logger.error('Error logging admin action', { error: e.message });
    }
}

// ========== AUTH ROUTES ==========

// Login page
router.get('/login', (req, res) => {
    if (req.session.adminId) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'login.html'));
});

// Login API
router.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const admin = await db.getAdminByEmail(email);
        if (!admin) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        if (admin.active !== 1) {
            return res.status(401).json({ error: 'Conta desativada' });
        }

        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        req.session.adminId = admin.id;
        await db.updateAdminLastLogin(admin.id);
        await logAction(req, 'LOGIN', 'Admin login realizado');

        res.json({ success: true });
    } catch (error) {
        logger.error('Admin login error', { error: error.message });
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Logout
router.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current admin
router.get('/api/me', requireAdmin, async (req, res) => {
    try {
        const admin = await db.getAdminById(req.session.adminId);
        if (!admin) {
            return res.status(401).json({ error: 'Admin não encontrado' });
        }
        res.json(admin);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar admin' });
    }
});

// ========== DASHBOARD ==========

router.get('/api/stats', requireAdmin, async (req, res) => {
    try {
        const stats = await db.getAdminStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting admin stats', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// ========== USER MANAGEMENT ==========

// List users
router.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || null;
        const offset = (page - 1) * limit;

        const users = await db.getAllUsers(limit, offset, search);
        const total = await db.getTotalUsersCount(search);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error listing users', { error: error.message });
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Get user details
router.get('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const user = await db.getUserByIdAdmin(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Get user's clients
        const clients = await db.getClientsByUserId(user.id);

        // Get user's complaints
        const complaints = await db.getAllComplaintsByUserId(user.id);

        // Get integrations
        const integrations = await db.getIntegrationsByUserId(user.id);

        res.json({
            user,
            clients,
            complaints: complaints.slice(0, 50), // Limit to 50
            integrations
        });
    } catch (error) {
        logger.error('Error getting user details', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar detalhes do usuário' });
    }
});

// Toggle user status
router.put('/api/users/:id/status', requireAdmin, async (req, res) => {
    try {
        const { active } = req.body;
        const userId = req.params.id;

        await db.updateUserStatus(userId, active);
        await logAction(req, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', `Usuário ${userId} ${active ? 'ativado' : 'desativado'}`, userId);

        res.json({ success: true });
    } catch (error) {
        logger.error('Error updating user status', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Delete user
router.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await db.getUserByIdAdmin(userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        await db.deleteUserAdmin(userId);
        await logAction(req, 'USER_DELETED', `Usuário ${user.email} deletado`, userId);

        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting user', { error: error.message });
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

// Login as user (impersonation)
router.post('/api/users/:id/impersonate', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await db.getUserFullData(userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Store admin session for later restoration
        req.session.impersonatingFrom = req.session.adminId;

        // Set user session
        req.session.userId = user.id;

        await logAction(req, 'USER_IMPERSONATION', `Admin fez login como usuário ${user.email}`, userId);

        res.json({ success: true, redirectTo: '/dashboard' });
    } catch (error) {
        logger.error('Error impersonating user', { error: error.message });
        res.status(500).json({ error: 'Erro ao fazer login como usuário' });
    }
});

// Return from impersonation
router.post('/api/stop-impersonation', async (req, res) => {
    try {
        if (req.session.impersonatingFrom) {
            const adminId = req.session.impersonatingFrom;
            delete req.session.userId;
            delete req.session.impersonatingFrom;
            req.session.adminId = adminId;
            res.json({ success: true, redirectTo: '/admin' });
        } else {
            res.status(400).json({ error: 'Não está em modo de impersonação' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao sair do modo de impersonação' });
    }
});

// ========== PLATFORM SETTINGS ==========

router.get('/api/settings', requireAdmin, async (req, res) => {
    try {
        const settings = await db.getAllPlatformSettings();
        res.json(settings);
    } catch (error) {
        logger.error('Error getting settings', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

router.put('/api/settings', requireAdmin, async (req, res) => {
    try {
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            await db.updatePlatformSetting(key, value);
        }

        // Recarregar configurações de email se SMTP foi alterado
        const smtpKeys = ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'];
        if (smtpKeys.some(key => key in settings)) {
            await emailService.reloadConfig();
            logger.info('Email service configuration reloaded');
        }

        await logAction(req, 'SETTINGS_UPDATED', `Configurações atualizadas: ${Object.keys(settings).join(', ')}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Error updating settings', { error: error.message });
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// ========== EMAIL TEST ==========

router.post('/api/test-email', requireAdmin, async (req, res) => {
    try {
        const result = await emailService.testEmailConfig();
        if (result.success) {
            await logAction(req, 'EMAIL_TEST', 'Teste de configuração SMTP realizado com sucesso');
            res.json({ success: true, message: 'Conexão SMTP verificada com sucesso!' });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        logger.error('Error testing email config', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== DATABASE STATS ==========

router.get('/api/database-stats', requireAdmin, async (req, res) => {
    try {
        const stats = await db.getDatabaseStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting database stats', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

router.post('/api/database/cleanup', requireAdmin, async (req, res) => {
    try {
        const { days } = req.body;
        const results = await db.cleanupOldData(days || 90);
        await logAction(req, 'DATABASE_CLEANUP', `Limpeza executada: ${JSON.stringify(results)}`);
        res.json({ success: true, results });
    } catch (error) {
        logger.error('Error cleaning database', { error: error.message });
        res.status(500).json({ error: 'Erro ao limpar banco de dados' });
    }
});

// ========== LOGS ==========

router.get('/api/logs', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const logs = await db.getAdminLogs(limit, offset);

        res.json({ logs });
    } catch (error) {
        logger.error('Error getting logs', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
});

// ========== CREATE USER/ADMIN ==========

// Create new user (from admin panel)
router.post('/api/users/create', requireAdmin, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.createUser(name, email, passwordHash);
        await logAction(req, 'USER_CREATED', `Usuario ${email} criado pelo admin`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Error creating user', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Create new admin
router.post('/api/admins', requireAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const existingAdmin = await db.getAdminByEmail(email);
        if (existingAdmin) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.createAdmin(email, passwordHash, name, role || 'admin');
        await logAction(req, 'ADMIN_CREATED', `Admin ${email} criado`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Error creating admin', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar admin' });
    }
});

// ========== ADMIN MANAGEMENT ==========

// Create initial admin (only if no admins exist)
router.post('/api/setup', async (req, res) => {
    try {
        // Check if any admin exists
        const existingAdmin = await db.getAdminByEmail('contato@opinaja.com.br');
        if (existingAdmin) {
            return res.status(400).json({ error: 'Setup já realizado' });
        }

        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.createAdmin(email, passwordHash, name, 'superadmin');

        res.json({ success: true, message: 'Admin criado com sucesso' });
    } catch (error) {
        logger.error('Error in admin setup', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar admin' });
    }
});

// ========== FEEDBACKS ==========

router.get('/api/feedbacks', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status || null;
        const type = req.query.type || null;

        const feedbacks = await db.getAllFeedbacks(limit, offset, status, type);
        const total = await db.getTotalFeedbacksCount(status, type);
        const stats = await db.getFeedbackStats();

        res.json({ feedbacks, total, stats, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error('Error getting feedbacks', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar feedbacks' });
    }
});

router.get('/api/feedbacks/:id', requireAdmin, async (req, res) => {
    try {
        const feedback = await db.getFeedbackById(req.params.id);
        if (!feedback) {
            return res.status(404).json({ error: 'Feedback não encontrado' });
        }
        res.json(feedback);
    } catch (error) {
        logger.error('Error getting feedback', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar feedback' });
    }
});

router.put('/api/feedbacks/:id', requireAdmin, async (req, res) => {
    try {
        const { status, admin_notes } = req.body;

        await db.updateFeedbackStatus(req.params.id, status, admin_notes);
        await logAction(req, 'FEEDBACK_UPDATED', `Feedback #${req.params.id} atualizado para ${status}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Error updating feedback', { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar feedback' });
    }
});

// ========== HTML PAGES (protected) ==========

router.get('/', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

router.get('/users', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

router.get('/users/:id', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

router.get('/settings', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

router.get('/logs', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

router.get('/billing', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

router.get('/feedbacks', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'index.html'));
});

module.exports = router;
