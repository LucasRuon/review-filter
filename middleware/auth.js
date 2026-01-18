const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-muito-segura-aqui-123';

function generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se o usuário existe e está ativo
    try {
        const user = await db.getUserByEmail((await db.getUserById(decoded.userId))?.email);
        if (!user || user.active === 0) {
            res.clearCookie('token');
            return res.status(403).json({ error: 'Sua conta está desativada. Entre em contato com o suporte.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar usuário' });
    }

    req.userId = decoded.userId;
    next();
}

module.exports = { generateToken, verifyToken, authMiddleware, JWT_SECRET };
