const logger = require('../logger');

const WHATSAPP_API_URL = 'https://audeagencia.uazapi.com';
const ADMIN_TOKEN = 'BatMrOd3sftAJGhwUApsvDt4V6XygQtTwAo5XvohTa8TW7ifal';

class WhatsAppService {
    constructor() {
        this.baseUrl = WHATSAPP_API_URL;
        this.adminToken = ADMIN_TOKEN;
    }

    async createInstance(instanceName) {
        try {
            const response = await fetch(`${this.baseUrl}/instance/init`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'admintoken': this.adminToken
                },
                body: JSON.stringify({
                    name: instanceName,
                    systemName: 'OpinaJá!',
                    fingerprintProfile: 'chrome',
                    browser: 'chrome'
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao criar instância: ${error}`);
            }

            const data = await response.json();
            return {
                success: true,
                token: data.token,
                instanceName: (data.instance && data.instance.name) || instanceName
            };
        } catch (error) {
            logger.error('WhatsApp createInstance error', { error: error.message });
            throw error;
        }
    }

    async connectInstance(token) {
        try {
            const response = await fetch(`${this.baseUrl}/instance/connect`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': token
                }
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao conectar instância: ${error}`);
            }

            const data = await response.json();

            // Verificar se já está conectado
            const isAlreadyConnected = data.connected === true ||
                                      (data.instance && data.instance.status === 'connected') ||
                                      (data.status && data.status.connected === true);

            // Se já está conectado, retornar imediatamente com estado 'open'
            if (isAlreadyConnected) {
                logger.info('WhatsApp already connected');
                return {
                    success: true,
                    alreadyConnected: true,
                    state: 'open'
                };
            }

            // Se não está conectado, extrair qrcode e paircode
            let qrcode = '';
            let paircode = '';

            if (data.instance) {
                qrcode = data.instance.qrcode || '';
                paircode = data.instance.paircode || '';
            }

            // Se não tem QR Code mas tem paircode, tenta buscar o QR Code
            if (!qrcode && paircode) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2s
                const qrData = await this.getQRCode(token);
                qrcode = qrData.qrcode;
            }

            // Extrair o estado correto
            let state = 'connecting';
            if (data.instance && data.instance.status) {
                state = data.instance.status;
            } else if (typeof data.status === 'string') {
                state = data.status;
            } else if (data.status && typeof data.status === 'object') {
                state = data.status.state || 'connecting';
            }

            return {
                success: true,
                qrcode: qrcode || undefined,
                paircode: paircode || undefined,
                state: state
            };
        } catch (error) {
            logger.error('WhatsApp connectInstance error', { error: error.message });
            throw error;
        }
    }

    async getQRCode(token) {
        try {
            const response = await fetch(`${this.baseUrl}/instance/qrcode`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            });

            if (!response.ok) {
                return { qrcode: null };
            }

            const data = await response.json();
            return {
                qrcode: data.qrcode || data.base64 || null
            };
        } catch (error) {
            logger.error('WhatsApp getQRCode error', { error: error.message });
            return { qrcode: null };
        }
    }

    async getInstanceStatus(token) {
        try {
            const response = await fetch(`${this.baseUrl}/instance/status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao obter status: ${error}`);
            }

            const data = await response.json();

            // Extrair o estado correto - a API pode retornar de várias formas
            let state = 'disconnected';
            let connected = false;

            // Tentar extrair de data.instance.status primeiro
            if (data.instance && data.instance.status) {
                state = data.instance.status;
            }
            // Tentar data.status como string
            else if (typeof data.status === 'string') {
                state = data.status;
            }
            // Tentar data.status como objeto com state
            else if (data.status && typeof data.status === 'object' && data.status.state) {
                state = data.status.state;
            }
            // Tentar data.state diretamente
            else if (typeof data.state === 'string') {
                state = data.state;
            }

            // Verificar se está conectado
            connected = state === 'open' || state === 'connected';

            return {
                success: true,
                state: state,
                connected: connected
            };
        } catch (error) {
            logger.error('WhatsApp getInstanceStatus error', { error: error.message });
            throw error;
        }
    }

    async deleteInstance(token) {
        try {
            const response = await fetch(`${this.baseUrl}/instance`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao deletar instância: ${error}`);
            }

            return { success: true };
        } catch (error) {
            logger.error('WhatsApp deleteInstance error', { error: error.message });
            throw error;
        }
    }

    async configureWebhook(token, webhookUrl) {
        try {
            const response = await fetch(`${this.baseUrl}/webhook`, {
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
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao configurar webhook: ${error}`);
            }

            return { success: true };
        } catch (error) {
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
        // Se for JID de grupo (@g.us), não normalizar
        const isGroupJid = number.includes('@g.us');
        const normalizedNumber = isGroupJid ? number : this.normalizePhoneNumber(number);

        logger.info('sendTextMessage called', {
            isGroup: isGroupJid,
            originalNumber: number,
            normalizedNumber: normalizedNumber,
            textLength: text?.length || 0
        });

        try {
            const response = await fetch(`${this.baseUrl}/send/text`, {
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
            });

            logger.info('WhatsApp API response', { status: response.status, ok: response.ok });

            if (!response.ok) {
                const errorText = await response.text();

                // Só tentar formato alternativo para números de telefone, não para grupos
                if (!isGroupJid && normalizedNumber.length === 13 && normalizedNumber.startsWith('55')) {
                    const ddd = normalizedNumber.substring(2, 4);
                    const num = normalizedNumber.substring(5);
                    const alternativeNumber = `55${ddd}${num}`;

                    logger.warn('Trying alternative number format', {
                        original: normalizedNumber,
                        alternative: alternativeNumber
                    });

                    const retryResponse = await fetch(`${this.baseUrl}/send/text`, {
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
                    });

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
            logger.error('WhatsApp sendTextMessage error', { error: error.message, number: normalizedNumber });
            throw error;
        }
    }

    async listGroups(token) {
        try {
            const response = await fetch(`${this.baseUrl}/group/list`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'token': token
                }
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao listar grupos: ${error}`);
            }

            const data = await response.json();

            // A API pode retornar os grupos em diferentes estruturas
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
            logger.error('WhatsApp listGroups error', { error: error.message });
            throw error;
        }
    }

    replaceMessageVariables(template, data) {
        let message = template;

        const variables = {
            '{cliente}': data.clientName || '',
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
