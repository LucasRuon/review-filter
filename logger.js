const logger = {
    formatTime: () => new Date().toISOString(),
    info: (msg, data = null) => {
        const log = `[${logger.formatTime()}] INFO: ${msg}`;
        console.log(data ? `${log} ${JSON.stringify(data)}` : log);
    },
    error: (msg, data = null) => {
        const log = `[${logger.formatTime()}] ERROR: ${msg}`;
        console.error(data ? `${log} ${JSON.stringify(data)}` : log);
    },
    warn: (msg, data = null) => {
        const log = `[${logger.formatTime()}] WARN: ${msg}`;
        console.warn(data ? `${log} ${JSON.stringify(data)}` : log);
    },
    req: (req, status = 200) => {
        const method = req.method.padEnd(6);
        const path = req.originalUrl || req.path;
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '-';
        console.log(`[${logger.formatTime()}] ${method} ${path} ${status} - ${ip}`);
    }
};

module.exports = logger;
