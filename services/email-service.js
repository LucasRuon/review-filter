const nodemailer = require('nodemailer');
const db = require('../database');
const logger = require('../logger');

let transporter = null;
let emailProvider = null; // 'smtp' ou 'resend'

// Cache para configuracoes de email
let cachedEmailFrom = null;
let cacheTime = 0;
const CACHE_TTL = 300000; // 5 minutos

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
    // Invalidar cache de email
    cachedEmailFrom = null;
    cacheTime = 0;
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

        // OTIMIZADO: Usar cache para configuracoes de email
        const now = Date.now();
        let fromEmail;
        if (cachedEmailFrom && (now - cacheTime) < CACHE_TTL) {
            fromEmail = cachedEmailFrom;
        } else {
            const settings = await db.getAllPlatformSettings();
            fromEmail = settings.email_from || settings.smtp_from || settings.smtp_user || 'noreply@opinaja.com.br';
            cachedEmailFrom = fromEmail;
            cacheTime = now;
        }
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
    const logoUrl = 'https://app.opinaja.com.br/images/logo-light.png';
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
            <a href="https://app.opinaja.com.br/login" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
            <a href="https://app.opinaja.com.br/login" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
            <a href="https://app.opinaja.com.br/complaints" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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

/**
 * Envia email de trial iniciado
 */
async function sendTrialStartedEmail(email, name, trialDays) {
    const subject = `Bem-vindo ao Opina Ja! Seu trial de ${trialDays} dias comecou`;
    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Ola, ${name}!</h2>
        <p style="margin: 0 0 15px; color: #475569; font-size: 16px; line-height: 1.6;">
            Seu periodo de teste de <strong>${trialDays} dias</strong> no Opina Ja comecou!
        </p>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Durante esse periodo, voce tera acesso completo a todas as funcionalidades PRO:
        </p>
        <ul style="margin: 0 0 25px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
            <li>Ate 10 clientes</li>
            <li>Integracao com WhatsApp</li>
            <li>Webhooks personalizados</li>
            <li>Relatorios avancados</li>
            <li>Exportacao de dados</li>
        </ul>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Aproveite ao maximo!
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.BASE_URL || 'https://app.opinaja.com.br'}/app" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Acessar Dashboard
            </a>
        </div>
    `;
    return sendEmail(email, subject, getBaseTemplate(content, 'Trial Iniciado - Opina Ja!'));
}

/**
 * Envia lembrete de trial expirando
 */
async function sendTrialReminder(email, name, daysRemaining) {
    const subject = daysRemaining === 1
        ? 'Ultimo dia do seu trial no Opina Ja!'
        : `Seu trial expira em ${daysRemaining} dias`;

    const urgencyMessage = daysRemaining === 1
        ? 'Hoje e o <strong>ultimo dia</strong> do seu periodo de teste!'
        : `Restam apenas <strong>${daysRemaining} dias</strong> do seu periodo de teste.`;

    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Ola, ${name}!</h2>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 0 0 20px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e; font-size: 16px;">
                ${urgencyMessage}
            </p>
        </div>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Para continuar usando todas as funcionalidades, faca upgrade para um plano pago.
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.BASE_URL || 'https://app.opinaja.com.br'}/pricing" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Ver Planos
            </a>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
            Nao perca acesso as funcionalidades PRO que voce esta usando!
        </p>
    `;
    return sendEmail(email, subject, getBaseTemplate(content, 'Trial Expirando - Opina Ja!'));
}

/**
 * Envia email de trial expirado
 */
async function sendTrialExpiredEmail(email, name) {
    const subject = 'Seu periodo de teste terminou';
    const content = `
        <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">Ola, ${name}!</h2>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 0 0 20px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 16px;">
                Seu periodo de teste no Opina Ja terminou.
            </p>
        </div>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Algumas funcionalidades foram bloqueadas, mas voce ainda pode:
        </p>
        <ul style="margin: 0 0 25px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
            <li>Visualizar seus dados</li>
            <li>Acessar configuracoes</li>
            <li>Fazer upgrade a qualquer momento</li>
        </ul>
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
            Para desbloquear todas as funcionalidades, escolha um plano:
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.BASE_URL || 'https://app.opinaja.com.br'}/pricing" style="display: inline-block; background: linear-gradient(135deg, #3750F0 0%, #2840D0 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Fazer Upgrade
            </a>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
            Seus dados estao seguros e serao mantidos. Faca upgrade quando quiser!
        </p>
    `;
    return sendEmail(email, subject, getBaseTemplate(content, 'Trial Expirado - Opina Ja!'));
}

/**
 * Envia email de assinatura ativada
 */
async function sendSubscriptionActivatedEmail(email, name, plan) {
    const subject = 'Sua assinatura esta ativa!';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">Obrigado, ${name}!</h1>
            <p style="font-size: 16px; line-height: 1.5;">Sua assinatura do plano <strong>${plan.toUpperCase()}</strong> foi ativada com sucesso.</p>
            <p style="font-size: 16px; line-height: 1.5;">Agora voce tem acesso completo a todas as funcionalidades do seu plano.</p>
            <a href="${process.env.BASE_URL}/app" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Acessar Dashboard</a>
        </div>
    `;
    return sendEmail(email, subject, html);
}

/**
 * Envia email de falha no pagamento
 */
async function sendPaymentFailedEmail(email, name) {
    const subject = 'Problema com seu pagamento';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f5576c;">Ola ${name}!</h1>
            <p style="font-size: 16px; line-height: 1.5;">Houve um problema ao processar seu pagamento.</p>
            <p style="font-size: 16px; line-height: 1.5;">Por favor, atualize suas informacoes de pagamento para evitar a interrupcao do servico.</p>
            <a href="${process.env.BASE_URL}/billing" style="display: inline-block; background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Atualizar Pagamento</a>
        </div>
    `;
    return sendEmail(email, subject, html);
}

/**
 * Envia email de assinatura cancelada
 */
async function sendSubscriptionCanceledEmail(email, name, endsAt) {
    const formattedDate = new Date(endsAt).toLocaleDateString('pt-BR');
    const subject = 'Sua assinatura foi cancelada';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Ola ${name}!</h1>
            <p style="font-size: 16px; line-height: 1.5;">Sua assinatura no Opina Ja foi cancelada.</p>
            <p style="font-size: 16px; line-height: 1.5;">Voce ainda tera acesso ate <strong>${formattedDate}</strong>.</p>
            <p style="font-size: 16px; line-height: 1.5;">Mudou de ideia? Voce pode reativar sua assinatura a qualquer momento.</p>
            <a href="${process.env.BASE_URL}/billing" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reativar Assinatura</a>
        </div>
    `;
    return sendEmail(email, subject, html);
}

/**
 * Envia notificacao de que os servicos foram desativados
 * @param {string} email
 * @param {string} name
 * @param {string} reason - 'trial_expired', 'subscription_canceled', 'payment_failed'
 */
async function sendServicesDeactivatedEmail(email, name, reason) {
    const reasonMessages = {
        'trial_expired': 'seu periodo de teste expirou',
        'subscription_canceled': 'sua assinatura foi cancelada',
        'payment_failed': 'houve um problema com seu pagamento'
    };

    const reasonMessage = reasonMessages[reason] || 'sua assinatura nao esta ativa';

    const subject = 'Seus servicos de avaliacao foram pausados - Opina Ja';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ef4444; margin-bottom: 20px;">Ola ${name}!</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Seus servicos de avaliacao no Opina Ja foram pausados porque ${reasonMessage}.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-top: 20px;">
                <strong>O que foi desativado:</strong>
            </p>
            <ul style="font-size: 16px; line-height: 1.8; color: #374151;">
                <li>Suas paginas de avaliacao estao temporariamente indisponiveis</li>
                <li>Suas instancias de WhatsApp foram desconectadas</li>
                <li>Novas reclamacoes nao serao recebidas</li>
            </ul>
            <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="font-size: 16px; line-height: 1.6; color: #166534; margin: 0;">
                    <strong>Seus dados estao seguros!</strong> Nada foi deletado.
                    Ao reativar sua assinatura, tudo voltara a funcionar normalmente.
                </p>
            </div>
            <a href="${process.env.BASE_URL}/pricing" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600;">
                Reativar Agora
            </a>
            <p style="font-size: 14px; color: #6B7280; margin-top: 30px;">
                Se tiver alguma duvida, entre em contato conosco.
            </p>
        </div>
    `;
    return sendEmail(email, subject, html);
}

module.exports = {
    initTransporter,
    reloadConfig,
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendPasswordChangedEmail,
    sendNewComplaintEmail,
    testEmailConfig,
    // Novos metodos de subscription
    sendTrialStartedEmail,
    sendTrialReminder,
    sendTrialExpiredEmail,
    sendSubscriptionActivatedEmail,
    sendPaymentFailedEmail,
    sendSubscriptionCanceledEmail,
    sendServicesDeactivatedEmail
};
