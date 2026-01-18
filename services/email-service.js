const nodemailer = require('nodemailer');
const db = require('../database');
const logger = require('../logger');

let transporter = null;

// Inicializar transporter com configurações do banco
async function initTransporter() {
    try {
        const settings = await db.getAllPlatformSettings();

        if (settings.smtp_enabled !== 'true') {
            logger.info('Email service disabled');
            return null;
        }

        if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
            logger.warn('Email service: SMTP not fully configured');
            return null;
        }

        transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: parseInt(settings.smtp_port) || 587,
            secure: parseInt(settings.smtp_port) === 465,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            }
        });

        // Verificar conexão
        await transporter.verify();
        logger.info('Email service initialized successfully');
        return transporter;
    } catch (error) {
        logger.error('Email service initialization failed', { error: error.message });
        transporter = null;
        return null;
    }
}

// Recarregar configurações (chamado quando settings são atualizadas)
async function reloadConfig() {
    return await initTransporter();
}

// Enviar email genérico
async function sendEmail(to, subject, html, text = null) {
    try {
        if (!transporter) {
            await initTransporter();
        }

        if (!transporter) {
            logger.warn('Email not sent: service not configured', { to, subject });
            return { success: false, error: 'Email service not configured' };
        }

        const settings = await db.getAllPlatformSettings();
        const from = settings.smtp_from || settings.smtp_user;

        const result = await transporter.sendMail({
            from: `"Opina Já!" <${from}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        });

        logger.info('Email sent successfully', { to, subject, messageId: result.messageId });
        return { success: true, messageId: result.messageId };
    } catch (error) {
        logger.error('Email send failed', { to, subject, error: error.message });
        return { success: false, error: error.message };
    }
}

// ========== TEMPLATES DE EMAIL ==========

// Template base
function getBaseTemplate(content, title = 'Opina Já!') {
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
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Opina Já!</h1>
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
                        <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 13px;">
                                Este email foi enviado por <strong>Opina Já!</strong><br>
                                Proteja sua reputação online e fidelize mais clientes.
                            </p>
                            <p style="margin: 10px 0 0; color: #94a3b8; font-size: 12px;">
                                © ${new Date().getFullYear()} Opina Já! - Todos os direitos reservados.
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
        if (!transporter) {
            await initTransporter();
        }

        if (!transporter) {
            return { success: false, error: 'Email service not configured' };
        }

        await transporter.verify();
        return { success: true, message: 'SMTP connection verified' };
    } catch (error) {
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
