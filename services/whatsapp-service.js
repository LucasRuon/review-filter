const logger = require('../logger');

// Credenciais via variaveis de ambiente
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://audeagencia.uazapi.com';
const ADMIN_TOKEN = process.env.WHATSAPP_ADMIN_TOKEN;

if (!ADMIN_TOKEN && process.env.NODE_ENV === 'production') {
    console.warn('Warning: WHATSAPP_ADMIN_TOKEN not configured');
}

// Fallback para desenvolvimento
const TOKEN = ADMIN_TOKEN || 'BatMrOd3sftAJGhwUApsvDt4V6XygQtTwAo5XvohTa8TW7ifal';

/**
 * Fetch com timeout configuravel
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

class WhatsAppService {
    constructor() {
        this.baseUrl = WHATSAPP_API_URL;
        this.adminToken = TOKEN;
    }

    async createInstance(instanceName) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance/init`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'admintoken': this.adminToken
                },
                body: JSON.stringify({
                    name: instanceName,
                    systemName: 'OpinaJa!',
                    fingerprintProfile: 'chrome',
                    browser: 'chrome'
                })
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao criar instancia: ${error}`);
            }

            const data = await response.json();
            return {
                success: true,
                token: data.token,
                instanceName: (data.instance && data.instance.name) || instanceName
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp createInstance timeout');
                throw new Error('Timeout ao criar instancia');
            }
            logger.error('WhatsApp createInstance error', { error: error.message });
            throw error;
        }
    }

    // Nova funcao com retry exponencial para buscar QR Code
    async getQRCodeWithRetry(token, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const qrData = await this.getQRCode(token);
            if (qrData.qrcode) {
                return qrData.qrcode;
            }

            if (attempt < maxRetries) {
                // Espera exponencial: 500ms, 1000ms, 2000ms
                const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }

    async connectInstance(token) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance/connect`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': token
                }
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao conectar instancia: ${error}`);
            }

            const data = await response.json();

            // Verificar se ja esta conectado
            const isAlreadyConnected = data.connected === true ||
                                      (data.instance && data.instance.status === 'connected') ||
                                      (data.status && data.status.connected === true);

            if (isAlreadyConnected) {
                logger.info('WhatsApp already connected');
                return {
                    success: true,
                    alreadyConnected: true,
                    state: 'open'
                };
            }

            // Extrair qrcode e paircode
            let qrcode = data.instance?.qrcode || '';
            let paircode = data.instance?.paircode || '';

            // CORRECAO: Buscar QR Code com retry exponencial ao inves de delay fixo
            if (!qrcode && paircode) {
                qrcode = await this.getQRCodeWithRetry(token, 3);
            }

            // Extrair o estado correto
            let state = 'connecting';
            if (data.instance?.status) {
                state = data.instance.status;
            } else if (typeof data.status === 'string') {
                state = data.status;
            } else if (data.status?.state) {
                state = data.status.state;
            }

            return {
                success: true,
                qrcode: qrcode || undefined,
                paircode: paircode || undefined,
                state: state
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp connectInstance timeout');
                throw new Error('Timeout ao conectar instancia');
            }
            logger.error('WhatsApp connectInstance error', { error: error.message });
            throw error;
        }
    }

    async getQRCode(token) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance/qrcode`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            }, 15000);

            if (!response.ok) {
                return { qrcode: null };
            }

            const data = await response.json();
            return {
                qrcode: data.qrcode || data.base64 || null
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp getQRCode timeout');
            } else {
                logger.error('WhatsApp getQRCode error', { error: error.message });
            }
            return { qrcode: null };
        }
    }

    async getInstanceStatus(token) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance/status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            }, 15000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao obter status: ${error}`);
            }

            const data = await response.json();

            // Extrair o estado correto
            let state = 'disconnected';
            let connected = false;

            if (data.instance?.status) {
                state = data.instance.status;
            } else if (typeof data.status === 'string') {
                state = data.status;
            } else if (data.status?.state) {
                state = data.status.state;
            } else if (typeof data.state === 'string') {
                state = data.state;
            }

            connected = state === 'open' || state === 'connected';

            return {
                success: true,
                state: state,
                connected: connected
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp getInstanceStatus timeout');
                throw new Error('Timeout ao obter status');
            }
            logger.error('WhatsApp getInstanceStatus error', { error: error.message });
            throw error;
        }
    }

    async disconnectInstance(token) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance/logout`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao desconectar instancia: ${error}`);
            }

            return { success: true };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp disconnectInstance timeout');
                throw new Error('Timeout ao desconectar instancia');
            }
            logger.error('WhatsApp disconnectInstance error', { error: error.message });
            throw error;
        }
    }

    async deleteInstance(token) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao deletar instancia: ${error}`);
            }

            return { success: true };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp deleteInstance timeout');
                throw new Error('Timeout ao deletar instancia');
            }
            logger.error('WhatsApp deleteInstance error', { error: error.message });
            throw error;
        }
    }

    async configureWebhook(token, webhookUrl) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/webhook`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': token
                },
                body: JSON.stringify({
                    enabled: true,
                    url: webhookUrl,
                    events: ['messages', 'connection'],
                    excludeMessages: ['wasSentByApi']
                })
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao configurar webhook: ${error}`);
            }

            return { success: true };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp configureWebhook timeout');
                throw new Error('Timeout ao configurar webhook');
            }
            logger.error('WhatsApp configureWebhook error', { error: error.message });
            throw error;
        }
    }

    normalizePhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');

        if (cleaned.startsWith('55')) {
            const ddd = cleaned.substring(2, 4);
            const number = cleaned.substring(4);

            if (number.length === 8) {
                cleaned = `55${ddd}9${number}`;
            } else if (number.length === 9 && !number.startsWith('9')) {
                cleaned = `55${ddd}9${number}`;
            }
        }

        return cleaned;
    }

    async sendTextMessage(token, number, text) {
        const isGroupJid = number.includes('@g.us');
        const normalizedNumber = isGroupJid ? number : this.normalizePhoneNumber(number);

        logger.info('sendTextMessage called', {
            isGroup: isGroupJid,
            originalNumber: number,
            normalizedNumber: normalizedNumber,
            textLength: text?.length || 0
        });

        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/send/text`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': token
                },
                body: JSON.stringify({
                    number: normalizedNumber,
                    text: text
                })
            }, 30000);

            logger.info('WhatsApp API response', { status: response.status, ok: response.ok });

            if (!response.ok) {
                const errorText = await response.text();

                // Tentar formato alternativo para numeros de telefone
                if (!isGroupJid && normalizedNumber.length === 13 && normalizedNumber.startsWith('55')) {
                    const ddd = normalizedNumber.substring(2, 4);
                    const num = normalizedNumber.substring(5);
                    const alternativeNumber = `55${ddd}${num}`;

                    logger.warn('Trying alternative number format', {
                        original: normalizedNumber,
                        alternative: alternativeNumber
                    });

                    const retryResponse = await fetchWithTimeout(`${this.baseUrl}/send/text`, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'token': token
                        },
                        body: JSON.stringify({
                            number: alternativeNumber,
                            text: text
                        })
                    }, 30000);

                    if (!retryResponse.ok) {
                        throw new Error(`Erro ao enviar mensagem: ${errorText}`);
                    }

                    const retryData = await retryResponse.json();
                    return {
                        success: true,
                        messageId: retryData.key?.id || null,
                        numberUsed: alternativeNumber
                    };
                }

                throw new Error(`Erro ao enviar mensagem: ${errorText}`);
            }

            const data = await response.json();
            return {
                success: true,
                messageId: data.key?.id || null,
                numberUsed: normalizedNumber
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp sendTextMessage timeout', { number: normalizedNumber });
                throw new Error('Timeout ao enviar mensagem');
            }
            logger.error('WhatsApp sendTextMessage error', { error: error.message, number: normalizedNumber });
            throw error;
        }
    }

    /**
     * Lista todas as instancias do usuario na UAZAPI
     */
    async listAllInstances() {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/instance/all`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'admintoken': this.adminToken
                }
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao listar instancias: ${error}`);
            }

            const data = await response.json();

            let instances = [];
            if (Array.isArray(data)) {
                instances = data;
            } else if (data.instances && Array.isArray(data.instances)) {
                instances = data.instances;
            } else if (data.data && Array.isArray(data.data)) {
                instances = data.data;
            }

            return {
                success: true,
                instances: instances
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp listAllInstances timeout');
                throw new Error('Timeout ao listar instancias');
            }
            logger.error('WhatsApp listAllInstances error', { error: error.message });
            throw error;
        }
    }

    async listGroups(token) {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}/group/list`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            }, 30000);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao listar grupos: ${error}`);
            }

            const data = await response.json();

            let groups = [];

            if (Array.isArray(data)) {
                groups = data;
            } else if (data.groups && Array.isArray(data.groups)) {
                groups = data.groups;
            } else if (data.data && Array.isArray(data.data)) {
                groups = data.data;
            }

            logger.info('Groups loaded', { count: groups.length });

            return {
                success: true,
                groups: groups
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('WhatsApp listGroups timeout');
                throw new Error('Timeout ao listar grupos');
            }
            logger.error('WhatsApp listGroups error', { error: error.message });
            throw error;
        }
    }

    replaceMessageVariables(template, data) {
        let message = template;

        const variables = {
            '{cliente}': data.clientName || '',
            '{filial}': data.branchName || 'Sede Principal',
            '{nome}': data.customerName || '',
            '{email}': data.customerEmail || '',
            '{telefone}': data.customerPhone || '',
            '{topico}': data.topicName || '',
            '{reclamacao}': data.complaintText || ''
        };

        Object.keys(variables).forEach(key => {
            message = message.replace(new RegExp(key, 'g'), variables[key]);
        });

        return message;
    }
}

module.exports = new WhatsAppService();
