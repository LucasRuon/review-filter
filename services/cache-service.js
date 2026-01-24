// services/cache-service.js
// Cache em memória para reduzir queries ao banco de dados

class CacheService {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map(); // Time-to-live para cada chave
    }

    /**
     * Obtém valor do cache
     * @param {string} key - Chave do cache
     * @returns {any} Valor ou undefined se expirado/inexistente
     */
    get(key) {
        const expiry = this.ttl.get(key);
        if (expiry && Date.now() > expiry) {
            this.delete(key);
            return undefined;
        }
        return this.cache.get(key);
    }

    /**
     * Define valor no cache
     * @param {string} key - Chave
     * @param {any} value - Valor
     * @param {number} ttlSeconds - Tempo de vida em segundos (padrao: 5 minutos)
     */
    set(key, value, ttlSeconds = 300) {
        this.cache.set(key, value);
        this.ttl.set(key, Date.now() + (ttlSeconds * 1000));
    }

    /**
     * Remove item do cache
     */
    delete(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
    }

    /**
     * Limpa todo o cache
     */
    clear() {
        this.cache.clear();
        this.ttl.clear();
    }

    /**
     * Limpa apenas itens expirados
     */
    cleanup() {
        const now = Date.now();
        for (const [key, expiry] of this.ttl.entries()) {
            if (now > expiry) {
                this.delete(key);
            }
        }
    }

    /**
     * Obtém estatisticas do cache
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Instancia singleton
const cacheService = new CacheService();

// Limpeza automatica a cada 5 minutos
setInterval(() => {
    cacheService.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheService;
