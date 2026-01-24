const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { generateToken, authMiddleware } = require('../middleware/auth');
const logger = require('../logger');
const emailService = require('../services/email-service');

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

        // Enviar email de boas-vindas (assíncrono, não bloqueia a resposta)
        emailService.sendWelcomeEmail(email.toLowerCase(), name).catch(err => {
            logger.error('Failed to send welcome email', { email: email.toLowerCase(), error: err.message });
        });

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

        // Verificar se o usuário está ativo
        if (user.active === 0) {
            logger.warn('Login attempt with inactive account', { userId: user.id, email: email.toLowerCase() });
            return res.status(403).json({ error: 'Sua conta está desativada. Entre em contato com o suporte.' });
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
        const { name, email, phone } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        const existingUser = await db.getUserByEmail(email.toLowerCase());
        if (existingUser && existingUser.id !== req.userId) {
            return res.status(400).json({ error: 'Este email já está em uso' });
        }

        await db.updateUser(req.userId, name, email.toLowerCase(), phone || null);
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
            body: JSON.stringify(testData),
            signal: AbortSignal.timeout(10000) // Timeout 10s
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

// ========== PASSWORD RESET ROUTES ==========

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Informe seu email' });
        }

        const user = await db.getUserByEmail(email.toLowerCase());

        // Sempre retorna sucesso para não revelar se o email existe
        if (!user) {
            logger.info('Password reset requested for unknown email', { email: email.toLowerCase() });
            return res.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de redefinição.' });
        }

        // Gerar token único
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        // Salvar token no banco
        await db.setPasswordResetToken(user.id, resetToken, expiresAt);

        // Gerar URL de reset
        const baseUrl = process.env.BASE_URL || 'https://opinaja.com.br';
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

        // Enviar email
        const emailResult = await emailService.sendPasswordResetEmail(
            user.email,
            user.name,
            resetToken,
            resetUrl
        );

        if (emailResult.success) {
            logger.info('Password reset email sent', { userId: user.id, email: user.email });
        } else {
            logger.error('Failed to send password reset email', { userId: user.id, error: emailResult.error });
        }

        res.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de redefinição.' });
    } catch (error) {
        logger.error('Forgot password error', { error: error.message });
        res.status(500).json({ error: 'Erro ao solicitar redefinição de senha' });
    }
});

// Verify reset token
router.get('/verify-reset-token', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ valid: false, error: 'Token não fornecido' });
        }

        const user = await db.getUserByResetToken(token);

        if (!user) {
            return res.json({ valid: false, error: 'Token inválido ou expirado' });
        }

        res.json({ valid: true, email: user.email });
    } catch (error) {
        logger.error('Verify reset token error', { error: error.message });
        res.status(500).json({ valid: false, error: 'Erro ao verificar token' });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const user = await db.getUserByResetToken(token);

        if (!user) {
            return res.status(400).json({ error: 'Token inválido ou expirado. Solicite uma nova redefinição.' });
        }

        // Atualizar senha
        const passwordHash = await bcrypt.hash(password, 10);
        await db.updateUserPassword(user.id, passwordHash);

        // Limpar token
        await db.clearPasswordResetToken(user.id);

        // Enviar email de confirmação
        emailService.sendPasswordChangedEmail(user.email, user.name).catch(err => {
            logger.error('Failed to send password changed email', { userId: user.id, error: err.message });
        });

        logger.info('Password reset successfully', { userId: user.id, email: user.email });
        res.json({ success: true, message: 'Senha alterada com sucesso! Você já pode fazer login.' });
    } catch (error) {
        logger.error('Reset password error', { error: error.message });
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});

// ========== FEEDBACK ROUTES ==========

// Submit feedback
router.post('/feedback', authMiddleware, async (req, res) => {
    try {
        const { type, rating, message } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'Tipo de feedback é obrigatório' });
        }

        const validTypes = ['nps', 'suggestion', 'bug', 'compliment'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Tipo de feedback inválido' });
        }

        if (type === 'nps' && (!rating || rating < 1 || rating > 5)) {
            return res.status(400).json({ error: 'Avaliação deve ser entre 1 e 5' });
        }

        await db.createFeedback(req.userId, type, rating, message);
        res.json({ success: true, message: 'Feedback enviado com sucesso! Obrigado!' });
    } catch (error) {
        logger.error('Feedback error', { error: error.message });
        res.status(500).json({ error: 'Erro ao enviar feedback' });
    }
});

// Check if should show NPS popup
router.get('/feedback/should-show-nps', authMiddleware, async (req, res) => {
    try {
        const lastFeedbackDate = await db.getUserLastFeedbackDate(req.userId);

        if (!lastFeedbackDate) {
            // Nunca deu feedback, mostrar popup
            return res.json({ shouldShow: true });
        }

        // Verificar se já passaram 14 dias desde o último feedback
        const daysSinceLastFeedback = Math.floor(
            (new Date() - new Date(lastFeedbackDate)) / (1000 * 60 * 60 * 24)
        );

        res.json({ shouldShow: daysSinceLastFeedback >= 14 });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar feedback' });
    }
});

// Skip NPS (mark as seen without submitting)
router.post('/feedback/skip-nps', authMiddleware, async (req, res) => {
    try {
        // Apenas atualiza a data para não mostrar novamente tão cedo
        await db.createFeedback(req.userId, 'nps_skipped', null, null);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao registrar' });
    }
});

module.exports = router;
