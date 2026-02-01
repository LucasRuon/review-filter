---
date: 2026-02-01T12:00:00-03:00
researcher: Claude
git_commit: 6b24e9423f905745c6b58715fcf3285d115e5436
branch: main
repository: review-filter
topic: "Sistema de assinaturas, cancelamento, trial, dashboard e notificações"
tags: [research, codebase, subscriptions, trial, notifications, billing]
status: complete
---

# Pesquisa: Sistema de Assinaturas, Cancelamento, Trial e Notificações

**Data**: 2026-02-01
**Branch**: main
**Commit**: 6b24e94

## Pergunta de Pesquisa

1. Como funciona o cancelamento de assinatura e onde mostrar a data de efeito do cancelamento
2. Onde está o dashboard e como adicionar notificações de trial expirando
3. Como funciona o sistema de trial e renovação

## Resumo

O sistema possui uma estrutura completa de gerenciamento de assinaturas integrada com Stripe. O cancelamento de assinatura já está implementado, mas **não exibe a data em que o cancelamento entrará em vigor**. O dashboard já possui um banner de trial, mas **não mostra a contagem de dias restantes de forma proeminente** nem uma notificação específica para trial expirado com call-to-action para comprar o plano PRO.

## Descobertas Detalhadas

### 1. Sistema de Cancelamento de Assinatura

#### Backend - Stripe Service (`services/stripe-service.js:599-634`)

A função `cancelUserSubscription` realiza o cancelamento:

```javascript
async cancelUserSubscription(userId, immediate = false, reason = null) {
    const user = await db.getUserWithSubscription(userId);
    if (!user || !user.stripe_subscription_id) {
        throw new Error('Nenhuma assinatura encontrada');
    }

    const subscription = await stripe.subscriptions.update(
        user.stripe_subscription_id,
        {
            cancel_at_period_end: !immediate,  // Cancela no fim do período
            metadata: {
                cancellation_reason: reason || 'user_requested'
            }
        }
    );

    // ... atualiza banco e loga evento
    return subscription;
}
```

**Observação importante**: O Stripe retorna `cancel_at_period_end: true` e `current_period_end` quando uma assinatura é agendada para cancelamento. Esses dados **não estão sendo retornados ao frontend** após o cancelamento.

#### Backend - Endpoint de Cancelamento (`routes/billing.js:203-219`)

```javascript
router.post('/cancel', authMiddleware, async (req, res) => {
    const { immediate, reason } = req.body;
    await stripeService.cancelUserSubscription(req.userId, immediate, reason);
    res.json({
        success: true,
        message: immediate
            ? 'Assinatura cancelada imediatamente'
            : 'Assinatura sera cancelada ao fim do periodo'
    });
});
```

**Problema identificado**: A resposta não inclui a data de cancelamento (`subscription_ends_at`).

#### Frontend - Cancelamento (`views/app.html:1205-1228`)

```javascript
window.cancelSubscription = async function() {
    if (!confirm('Tem certeza que deseja cancelar...')) return;

    const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: false, reason: 'user_requested' })
    });
    const data = await res.json();
    if (data.success) {
        showToast('Assinatura cancelada. Voce tera acesso ate o fim do periodo.');
        loadSubscriptionData();
    }
};
```

**Problema identificado**: O toast não mostra a data específica do cancelamento.

#### Frontend - Exibição de Status (`views/app.html:1135-1149`)

```javascript
if (sub.endsAt) {
    const endsAt = new Date(sub.endsAt);
    const label = (sub.status === 'trial' || sub.isTrialing)
        ? 'Fim do trial'
        : 'Proxima renovacao';  // <-- Não diferencia "cancelado"
    document.getElementById('subRenewalLabel').textContent = label;
    document.getElementById('subRenewalDate').textContent = endsAt.toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
}
```

**Problema identificado**: Não há tratamento para status `canceled` - deveria mostrar "Cancelamento em" ou "Acesso até" ao invés de "Próxima renovação".

---

### 2. Dashboard e Notificações de Trial

#### Dashboard Template (`views/spa/dashboard.html:1-138`)

O dashboard já possui um banner de trial com os seguintes estados:

1. **Trial ativo** (amarelo): Mostra dias restantes
2. **Trial expirado** (vermelho): Mostra mensagem para fazer upgrade

```html
<div class="trial-banner" id="trialBanner" style="display: none;">
    <div class="trial-banner-content">
        <div class="trial-banner-icon"><i class="fas fa-clock"></i></div>
        <div class="trial-banner-text">
            <h3 id="trialBannerTitle">Periodo de teste</h3>
            <p id="trialBannerText">Restam X dias do seu trial...</p>
        </div>
    </div>
    <a href="/pricing" class="trial-banner-btn">Fazer upgrade</a>
</div>
```

#### Lógica do Banner (`views/spa/dashboard.html:76-104`)

```javascript
function showTrialBanner() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const sub = user.subscription || {};

    if (sub.status === 'trial' && sub.days_remaining !== undefined) {
        banner.style.display = 'flex';
        // ... mostra dias restantes
    } else if (sub.status === 'expired') {
        banner.style.display = 'flex';
        banner.classList.add('expired');
        // ... mostra mensagem de expirado
    }
}
```

**Observação**: O banner funciona, mas depende de `user.subscription.days_remaining` estar no localStorage. Os dados são carregados via `/api/auth/me` que retorna `subscription` com `days_remaining`.

---

### 3. Sistema de Trial e Renovação

#### Estrutura do Banco de Dados (`database.js:286-315`)

Campos relevantes na tabela `users`:
- `subscription_status`: 'free', 'trial', 'active', 'expired', 'canceled', 'past_due'
- `subscription_plan`: 'free', 'pro'
- `subscription_ends_at`: Data de término
- `trial_started_at`: Início do trial
- `trial_reminder_sent`: Nível de lembrete enviado (0, 1, 3)
- `cancelled_at`: Data do cancelamento
- `cancellation_reason`: Motivo do cancelamento

#### Função `getSubscriptionInfo` (`database.js:1843-1882`)

```javascript
async function getSubscriptionInfo(userId) {
    const result = await pool.query(`
        SELECT
            subscription_status,
            subscription_plan,
            stripe_customer_id,
            stripe_subscription_id,
            subscription_ends_at,
            trial_started_at,
            trial_reminder_sent,
            last_payment_at,
            payment_failed_at,
            EXTRACT(DAY FROM (subscription_ends_at - NOW())) as days_remaining
        FROM users WHERE id = $1
    `, [userId]);

    return {
        status: user.subscription_status,
        plan: user.subscription_plan,
        endsAt: user.subscription_ends_at,
        daysRemaining: Math.max(0, Math.floor(user.days_remaining || 0)),
        isTrialing: user.subscription_status === 'trial',
        isActive: ['trial', 'active'].includes(user.subscription_status),
        isExpired: user.subscription_status === 'expired' || ...
    };
}
```

**Observação**: A função já calcula `daysRemaining` diretamente no SQL.

#### Jobs de Trial (`jobs/subscription-jobs.js`)

- **Lembretes de trial** (diário às 9h): Envia emails 3 dias e 1 dia antes de expirar
- **Trials expirados** (a cada hora): Marca como `expired` e desativa recursos
- **Sincronização Stripe** (diário à meia-noite): Sincroniza status com Stripe

---

### 4. Endpoint `/api/billing/subscription` (`routes/billing.js:148-163`)

```javascript
router.get('/subscription', authMiddleware, async (req, res) => {
    const subInfo = await db.getSubscriptionInfo(req.userId);
    const limits = await db.getPlanLimits(subInfo?.plan || 'free');
    res.json({
        success: true,
        subscription: subInfo,
        limits
    });
});
```

Este endpoint retorna todos os dados necessários, mas **não inclui informação específica de cancelamento agendado** (como `cancel_at_period_end`).

---

## Referências de Código

| Arquivo | Linha | Descrição |
|---------|-------|-----------|
| `services/stripe-service.js` | 599-634 | Função `cancelUserSubscription` |
| `services/stripe-service.js` | 20-31 | Função `getSubscriptionEndDate` |
| `routes/billing.js` | 203-219 | Endpoint POST `/api/billing/cancel` |
| `routes/billing.js` | 148-163 | Endpoint GET `/api/billing/subscription` |
| `database.js` | 1843-1882 | Função `getSubscriptionInfo` |
| `database.js` | 1887-1906 | Função `updateSubscriptionStatus` |
| `jobs/subscription-jobs.js` | 14-63 | Função `processTrialReminders` |
| `jobs/subscription-jobs.js` | 70-101 | Função `processExpiredTrials` |
| `views/spa/dashboard.html` | 1-108 | Template do dashboard com banner de trial |
| `views/spa/profile.html` | 236-356 | Seção de assinatura no perfil |
| `views/app.html` | 1075-1190 | Função `loadSubscriptionData` |
| `views/app.html` | 1205-1228 | Função `cancelSubscription` |

## Padrões Arquiteturais

1. **Stripe Integration**: Webhook-driven para eventos de subscription
2. **Status Flow**: free → trial → active/expired/canceled
3. **Frontend State**: Dados de subscription em `localStorage.user.subscription`
4. **Banner System**: Condicional baseado em `sub.status` e `sub.days_remaining`

## Tecnologias e Integrações

| Tecnologia | Uso no Projeto | Arquivos Relacionados |
|------------|----------------|----------------------|
| Stripe API | Pagamentos/Subscriptions | `services/stripe-service.js`, `routes/billing.js` |
| node-cron | Jobs agendados | `jobs/subscription-jobs.js` |
| PostgreSQL | Status de subscription | `database.js` |

## Lacunas Identificadas para Implementação

### 1. Cancelamento - Data de Efeito
- **Backend**: Endpoint `/api/billing/cancel` deve retornar `subscription_ends_at`
- **Backend**: Endpoint `/api/billing/subscription` deve retornar flag `isCanceled` ou `cancel_at_period_end`
- **Frontend**: Após cancelamento, mostrar data exata no toast
- **Frontend**: Na seção de assinatura, mostrar "Acesso até [data]" quando status = canceled

### 2. Dashboard - Notificação de Trial
- **Frontend**: O banner já existe, mas precisa:
  - Mostrar número de dias de forma mais proeminente
  - Após expirado, mostrar CTA claro para comprar PRO
  - Verificar se `subscription` está sendo populado corretamente no `localStorage`

### 3. Campos Faltantes no Banco/API
- Campo `cancel_at_period_end` não está sendo armazenado/retornado
- Considerar adicionar à query de `getSubscriptionInfo`

## Questões em Aberto

1. O status `canceled` no Stripe pode significar "agendado para cancelar" (`cancel_at_period_end: true`) ou "efetivamente cancelado". A API deve distinguir esses estados.
