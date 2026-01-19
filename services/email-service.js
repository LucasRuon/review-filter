const nodemailer = require('nodemailer');
const db = require('../database');
const logger = require('../logger');

let transporter = null;
let emailProvider = null; // 'smtp' ou 'resend'

// Inicializar transporter com configurações do banco
async function initTransporter() {
    try {
        const settings = await db.getAllPlatformSettings();

        logger.info('Initializing email service...', {
            smtp_enabled: settings.smtp_enabled,
            smtp_host: settings.smtp_host,
            smtp_port: settings.smtp_port,
            smtp_user: settings.smtp_user ? '***configured***' : 'NOT SET',
            smtp_pass: settings.smtp_pass ? '***configured***' : 'NOT SET',
            resend_api_key: settings.resend_api_key ? '***configured***' : 'NOT SET'
        });

        // Primeiro tenta Resend (API HTTP - funciona no Railway)
        if (settings.resend_api_key) {
            logger.info('Using Resend API for email delivery');
            emailProvider = 'resend';
            transporter = { type: 'resend', apiKey: settings.resend_api_key };
            return transporter;
        }

        // Fallback para SMTP tradicional
        if (settings.smtp_enabled !== 'true') {
            logger.info('Email service disabled - smtp_enabled is not true and no Resend API key');
            return null;
        }

        if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
            logger.warn('Email service: SMTP not fully configured', {
                has_host: !!settings.smtp_host,
                has_user: !!settings.smtp_user,
                has_pass: !!settings.smtp_pass
            });
            return null;
        }

        const port = parseInt(settings.smtp_port) || 587;
        logger.info(`Creating SMTP transporter: ${settings.smtp_host}:${port}`);

        emailProvider = 'smtp';
        transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: port,
            secure: port === 465,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            },
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 60000,
            logger: false,
            debug: false,
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verificar conexão SMTP
        logger.info('Verifying SMTP connection...');
        await Promise.race([
            transporter.verify(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na conexão SMTP')), 30000))
        ]);
        logger.info('Email service initialized successfully (SMTP)');
        return transporter;
    } catch (error) {
        logger.error('Email service initialization failed', { error: error.message });
        transporter = null;
        emailProvider = null;
        return null;
    }
}

// Recarregar configurações (chamado quando settings são atualizadas)
async function reloadConfig() {
    transporter = null;
    emailProvider = null;
    return await initTransporter();
}

// Enviar email via Resend API
async function sendViaResend(apiKey, from, to, subject, html) {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: from,
            to: [to],
            subject: subject,
            html: html
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Resend API error: ${response.status}`);
    }

    return { messageId: data.id };
}

// Enviar email genérico
async function sendEmail(to, subject, html, text = null) {
    try {
        // Sempre tenta reinicializar se não há transporter
        if (!transporter) {
            logger.info('Email transporter not initialized, attempting to initialize...');
            await initTransporter();
        }

        // Se ainda não tem transporter, tenta forçar reinicialização
        if (!transporter) {
            logger.warn('Transporter still null, forcing reload...');
            await reloadConfig();
        }

        if (!transporter) {
            logger.warn('Email not sent: service not configured', { to, subject });
            return { success: false, error: 'Email service not configured - configure Resend API ou SMTP no painel admin' };
        }

        const settings = await db.getAllPlatformSettings();
        const fromEmail = settings.email_from || settings.smtp_from || settings.smtp_user || 'noreply@opinaja.com.br';
        const fromName = 'Opina Já!';

        let result;

        // Usar Resend API se configurado
        if (emailProvider === 'resend') {
            logger.info('Sending email via Resend API', { to, subject });
            result = await sendViaResend(
                transporter.apiKey,
                `${fromName} <${fromEmail}>`,
                to,
                subject,
                html
            );
        } else {
            // Usar SMTP tradicional
            logger.info('Sending email via SMTP', { to, subject });
            result = await transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, '')
            });
        }

        logger.info('Email sent successfully', { to, subject, messageId: result.messageId, provider: emailProvider });
        return { success: true, messageId: result.messageId };
    } catch (error) {
        logger.error('Email send failed', { to, subject, error: error.message, provider: emailProvider });
        return { success: false, error: error.message };
    }
}

// ========== TEMPLATES DE EMAIL ==========

// Template base
function getBaseTemplate(content, title = 'Opina Já!') {
    const logoUrl = 'https://opinaja.com.br/images/logo-light.png';
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
                    <!-- Header com Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 30px; text-align: center;">
                            <img src="${logoUrl}" alt="Opina Já!" style="height: 64px; width: auto; max-width: 250px;" />
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                                Este email foi enviado por <strong>Opina Já!</strong><br>
                                Feedback Inteligente - Proteja sua reputacao online.
                            </p>
                            <p style="margin: 12px 0 0; color: #94a3b8; font-size: 11px;">
                                &copy; ${new Date().getFullYear()} Opina Ja! - Todos os direitos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// Email de boas-vindas
async function sendWelcomeEmail(userEmail, userName) {
    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Bem-vindo(a), ${userName}! 🎉</h2>
        <p style="margin: 0 0 15px; color: #475569; font-size: 16px; line-height: 1.6;">
            Estamos muito felizes em ter você conosco! Sua conta no <strong>Opina Já!</strong> foi criada com sucesso.
        </p>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Com o Opina Já, você pode:
        </p>
        <ul style="margin: 0 0 25px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
            <li>Direcionar avaliações positivas para o Google</li>
            <li>Capturar reclamações de forma privada</li>
            <li>Acompanhar feedbacks em tempo real</li>
            <li>Melhorar a reputação do seu negócio</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://opinaja.com.br/login" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Acessar minha conta
            </a>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
            Se tiver qualquer dúvida, responda este email ou acesse nosso suporte.
        </p>
    `;

    return await sendEmail(
        userEmail,
        'Bem-vindo ao Opina Já! 🎉',
        getBaseTemplate(content, 'Bem-vindo ao Opina Já!')
    );
}

// Email de redefinição de senha
async function sendPasswordResetEmail(userEmail, userName, resetToken, resetUrl) {
    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Redefinir sua senha</h2>
        <p style="margin: 0 0 15px; color: #475569; font-size: 16px; line-height: 1.6;">
            Olá, ${userName}!
        </p>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Recebemos uma solicitação para redefinir a senha da sua conta no Opina Já.
            Clique no botão abaixo para criar uma nova senha:
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Redefinir minha senha
            </a>
        </div>
        <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
            Ou copie e cole este link no seu navegador:
        </p>
        <p style="margin: 0 0 20px; color: #3750F0; font-size: 13px; word-break: break-all;">
            ${resetUrl}
        </p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚠️ Atenção:</strong> Este link expira em <strong>1 hora</strong>. Se você não solicitou esta redefinição, ignore este email.
            </p>
        </div>
    `;

    return await sendEmail(
        userEmail,
        'Redefinir sua senha - Opina Já!',
        getBaseTemplate(content, 'Redefinir Senha')
    );
}

// Email de confirmação de alteração de senha
async function sendPasswordChangedEmail(userEmail, userName) {
    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Senha alterada com sucesso ✅</h2>
        <p style="margin: 0 0 15px; color: #475569; font-size: 16px; line-height: 1.6;">
            Olá, ${userName}!
        </p>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Sua senha foi alterada com sucesso. Você já pode acessar sua conta com a nova senha.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">
                <strong>🔒 Não foi você?</strong> Se você não realizou esta alteração, entre em contato conosco imediatamente.
            </p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://opinaja.com.br/login" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Acessar minha conta
            </a>
        </div>
    `;

    return await sendEmail(
        userEmail,
        'Senha alterada com sucesso - Opina Já!',
        getBaseTemplate(content, 'Senha Alterada')
    );
}

// Email de nova reclamação (para o dono do estabelecimento)
async function sendNewComplaintEmail(userEmail, userName, clientName, complaint) {
    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Nova reclamação recebida 📩</h2>
        <p style="margin: 0 0 15px; color: #475569; font-size: 16px; line-height: 1.6;">
            Olá, ${userName}!
        </p>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Você recebeu uma nova reclamação no <strong>${clientName}</strong>.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600;">Detalhes da reclamação</p>
            ${complaint.name ? `<p style="margin: 5px 0; color: #1e293b; font-size: 15px;"><strong>Nome:</strong> ${complaint.name}</p>` : ''}
            ${complaint.email ? `<p style="margin: 5px 0; color: #1e293b; font-size: 15px;"><strong>Email:</strong> ${complaint.email}</p>` : ''}
            ${complaint.phone ? `<p style="margin: 5px 0; color: #1e293b; font-size: 15px;"><strong>Telefone:</strong> ${complaint.phone}</p>` : ''}
            ${complaint.topic_name ? `<p style="margin: 5px 0; color: #1e293b; font-size: 15px;"><strong>Tópico:</strong> ${complaint.topic_name}</p>` : ''}
            <p style="margin: 15px 0 0; color: #1e293b; font-size: 15px;"><strong>Mensagem:</strong></p>
            <p style="margin: 5px 0; color: #475569; font-size: 15px; white-space: pre-wrap;">${complaint.complaint}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://opinaja.com.br/complaints" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Ver reclamação
            </a>
        </div>
    `;

    return await sendEmail(
        userEmail,
        `Nova reclamação - ${clientName}`,
        getBaseTemplate(content, 'Nova Reclamação')
    );
}

// Testar configuração de email
async function testEmailConfig() {
    try {
        // Sempre força reinicialização para testar com configs atuais
        logger.info('Testing email config - forcing transporter reload');
        transporter = null;
        emailProvider = null;
        await initTransporter();

        if (!transporter) {
            const settings = await db.getAllPlatformSettings();
            if (settings.resend_api_key) {
                return { success: false, error: 'Resend API key configurada mas falhou ao inicializar' };
            }
            if (settings.smtp_enabled !== 'true') {
                return { success: false, error: 'Email não configurado. Configure Resend API key ou ative SMTP.' };
            }
            if (!settings.smtp_host) {
                return { success: false, error: 'Host SMTP não configurado' };
            }
            if (!settings.smtp_user) {
                return { success: false, error: 'Usuário SMTP não configurado' };
            }
            if (!settings.smtp_pass) {
                return { success: false, error: 'Senha SMTP não configurada' };
            }
            return { success: false, error: 'Falha ao criar conexão - verifique as credenciais' };
        }

        // Se é Resend, só retorna sucesso (não há como verificar sem enviar)
        if (emailProvider === 'resend') {
            return { success: true, message: 'Resend API configurada! Envie um email de teste para verificar.' };
        }

        // Se é SMTP, verifica a conexão
        await transporter.verify();
        return { success: true, message: 'Conexão SMTP verificada com sucesso!' };
    } catch (error) {
        logger.error('Email config test failed', { error: error.message });
        return { success: false, error: error.message };
    }
}

module.exports = {
    initTransporter,
    reloadConfig,
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendPasswordChangedEmail,
    sendNewComplaintEmail,
    testEmailConfig
};
