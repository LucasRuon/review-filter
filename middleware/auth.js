const jwt = require('jsonwebtoken');
const db = require('../database');
const cache = require('../services/cache-service');

// JWT_SECRET obrigatorio em producao
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
}

// Fallback apenas para desenvolvimento
const SECRET = JWT_SECRET || 'dev-secret-change-in-production';

function generateToken(userId) {
    return jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch {
        return null;
    }
}

async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Token nao fornecido' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token invalido' });
    }

    // FASE 6: Cache de verificação do usuário - TTL de 60 segundos
    const cacheKey = `auth_user_${decoded.userId}`;
    let user = cache.get(cacheKey);

    if (!user) {
        try {
            user = await db.getUserByIdWithStatus(decoded.userId);
            if (!user) {
                res.clearCookie('token');
                return res.status(401).json({ error: 'Usuario nao encontrado' });
            }
            if (user.active === 0) {
                res.clearCookie('token');
                return res.status(403).json({ error: 'Sua conta esta desativada. Entre em contato com o suporte.' });
            }
            // Cachear usuário válido
            cache.set(cacheKey, user, 60); // 60 segundos
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao verificar usuario' });
        }
    } else if (user.active === 0) {
        // Re-verificar do cache
        res.clearCookie('token');
        cache.delete(cacheKey);
        return res.status(403).json({ error: 'Sua conta esta desativada. Entre em contato com o suporte.' });
    }

    req.userId = decoded.userId;
    next();
}

module.exports = { generateToken, verifyToken, authMiddleware, JWT_SECRET: SECRET };
