const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { generateToken, authMiddleware } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const existingUser = await db.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            logger.warn('Register attempt with existing email', { email: email.toLowerCase() });
            return res.status(400).json({ error: 'Este email já está cadastrado' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.createUser(name, email.toLowerCase(), passwordHash, phone || null);

        const token = generateToken(result.lastInsertRowid);
        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

        logger.info('New user registered', { userId: result.lastInsertRowid, email: email.toLowerCase() });
        res.json({ success: true, message: 'Conta criada com sucesso!' });
    } catch (error) {
        logger.error('Register error', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar conta' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        const user = await db.getUserByEmail(email.toLowerCase());
        if (!user) {
            logger.warn('Login attempt with unknown email', { email: email.toLowerCase() });
            return res.status(400).json({ error: 'Email ou senha incorretos' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            logger.warn('Login attempt with wrong password', { userId: user.id, email: email.toLowerCase() });
            return res.status(400).json({ error: 'Email ou senha incorretos' });
        }

        const token = generateToken(user.id);
        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

        logger.info('User logged in', { userId: user.id, email: email.toLowerCase() });
        res.json({ success: true, message: 'Login realizado com sucesso!' });
    } catch (error) {
        logger.error('Login error', { error: error.message });
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await db.getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        const existingUser = await db.getUserByEmail(email.toLowerCase());
        if (existingUser && existingUser.id !== req.userId) {
            return res.status(400).json({ error: 'Este email já está em uso' });
        }

        await db.updateUser(req.userId, name, email.toLowerCase());
        res.json({ success: true, message: 'Perfil atualizado!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Change password
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
        }

        const userInfo = await db.getUserById(req.userId);
        const user = await db.getUserByEmail(userInfo.email);
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!validPassword) {
            return res.status(400).json({ error: 'Senha atual incorreta' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.updateUserPassword(req.userId, passwordHash);

        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// Get dashboard stats
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await db.getStats(req.userId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Get integrations
router.get('/integrations', authMiddleware, async (req, res) => {
    try {
        const integrations = await db.getIntegrationsByUserId(req.userId);
        res.json(integrations || {});
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar integrações' });
    }
});

// Update integrations
router.put('/integrations', authMiddleware, async (req, res) => {
    try {
        const result = await db.updateIntegrations(req.userId, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar integrações' });
    }
});

// Test webhook
router.post('/integrations/test-webhook', authMiddleware, async (req, res) => {
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

module.exports = router;
