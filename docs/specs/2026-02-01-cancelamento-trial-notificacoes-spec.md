---
date: 2026-02-01T14:00:00-03:00
author: Claude
status: draft
ticket: null
research: docs/research/2026-02-01-subscription-cancelamento-trial-notificacoes.md
---

# Spec: Melhorias no Sistema de Cancelamento e Notificações de Trial

**Data**: 2026-02-01
**Baseado em**: docs/research/2026-02-01-subscription-cancelamento-trial-notificacoes.md
**Estimativa**: Média

## Objetivo

Implementar três melhorias no sistema de assinaturas:

1. **Exibir data de efeito do cancelamento** - Quando o usuário cancela a assinatura, mostrar claramente até quando ele terá acesso ao sistema
2. **Melhorar notificações de trial no dashboard** - Tornar o banner de trial mais proeminente e adicionar CTA claro quando expirado
3. **Distinguir estados de cancelamento** - Diferenciar entre "agendado para cancelar" e "efetivamente cancelado"

## Escopo

### Incluído
- Retornar `subscription_ends_at` na resposta do endpoint de cancelamento
- Adicionar flag `isCanceledAtPeriodEnd` na API de subscription
- Atualizar label de "Próxima renovação" para "Acesso até" quando cancelado
- Melhorar visual do banner de trial com contagem de dias destacada
- Adicionar CTA mais claro para upgrade quando trial expirado

### Não Incluído
- Mudanças na lógica de cancelamento do Stripe
- Novos emails de notificação
- Mudanças na estrutura de preços

## Pré-requisitos

- [ ] Acesso ao ambiente de desenvolvimento
- [ ] Banco de dados PostgreSQL rodando
- [ ] Variáveis de ambiente configuradas (Stripe keys)

---

## Fases de Implementação

### Fase 1: Backend - Melhorar Retorno do Cancelamento

**Objetivo:** Retornar dados completos do cancelamento incluindo a data de término

#### Arquivos a Modificar:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `routes/billing.js` | Modificar | Retornar `subscription_ends_at` no endpoint de cancelamento |
| `database.js` | Modificar | Adicionar campo `cancel_at_period_end` em `getSubscriptionInfo` |

#### Detalhes de Implementação:

**1. `routes/billing.js` - Endpoint de Cancelamento**

Modificar o endpoint POST `/api/billing/cancel` (linhas ~203-219) para retornar a data de término:

```javascript
// routes/billing.js - endpoint POST /cancel
router.post('/cancel', authMiddleware, async (req, res) => {
    try {
        const { immediate, reason } = req.body;
        const subscription = await stripeService.cancelUserSubscription(req.userId, immediate, reason);

        // Buscar informações atualizadas após cancelamento
        const subInfo = await db.getSubscriptionInfo(req.userId);

        res.json({
            success: true,
            message: immediate
                ? 'Assinatura cancelada imediatamente'
                : 'Assinatura sera cancelada ao fim do periodo',
            subscription_ends_at: subInfo?.endsAt || subscription.current_period_end * 1000,
            cancel_at_period_end: !immediate
        });
    } catch (error) {
        console.error('[BILLING_CANCEL_ERROR]', error);
        res.status(500).json({ error: error.message || 'Erro ao cancelar assinatura' });
    }
});
```

**2. `database.js` - Função `getSubscriptionInfo`**

Adicionar campo `cancelled_at` ao retorno (linhas ~1843-1882):

```javascript
// Dentro da função getSubscriptionInfo, adicionar ao SELECT:
// cancelled_at

// E no objeto de retorno, adicionar:
return {
    status: user.subscription_status,
    plan: user.subscription_plan,
    endsAt: user.subscription_ends_at,
    daysRemaining: Math.max(0, Math.floor(user.days_remaining || 0)),
    isTrialing: user.subscription_status === 'trial',
    isActive: ['trial', 'active'].includes(user.subscription_status),
    isExpired: user.subscription_status === 'expired' || ...,
    // NOVO: Adicionar informação de cancelamento
    isCanceled: user.subscription_status === 'canceled',
    canceledAt: user.cancelled_at,
    // Se status é 'active' mas tem cancelled_at, está agendado para cancelar
    isCanceledAtPeriodEnd: user.subscription_status === 'active' && user.cancelled_at !== null
};
```

#### Critérios de Sucesso - Fase 1:

**Verificação Automatizada:**
- [x] Servidor inicia sem erros: `npm start`
- [x] Sem erros no console durante inicialização

**Verificação Manual:**
- [ ] Endpoint `/api/billing/cancel` retorna `subscription_ends_at`
- [ ] Endpoint `/api/billing/subscription` retorna `isCanceledAtPeriodEnd`

**Teste via curl:**
```bash
# Testar endpoint de subscription (ajustar token)
curl http://localhost:3000/api/billing/subscription \
  -H "Cookie: token=SEU_TOKEN"

# Deve retornar subscription com campos:
# - endsAt
# - isCanceled
# - isCanceledAtPeriodEnd
```

---

### Fase 2: Frontend - Exibir Data de Cancelamento

**Objetivo:** Mostrar claramente a data até quando o usuário terá acesso após cancelar

#### Arquivos a Modificar:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `views/app.html` | Modificar | Atualizar toast após cancelamento e label de renovação |

#### Detalhes de Implementação:

**1. `views/app.html` - Função `cancelSubscription` (linhas ~1205-1228)**

Atualizar para mostrar data específica no toast:

```javascript
window.cancelSubscription = async function() {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Você continuará tendo acesso até o fim do período atual.')) return;

    try {
        const res = await fetch('/api/billing/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ immediate: false, reason: 'user_requested' })
        });
        const data = await res.json();

        if (data.success) {
            // Formatar data de término
            let message = 'Assinatura cancelada.';
            if (data.subscription_ends_at) {
                const endsAt = new Date(data.subscription_ends_at);
                const formattedDate = endsAt.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                message = `Assinatura cancelada. Você terá acesso até ${formattedDate}.`;
            }
            showToast(message, 'success');
            loadSubscriptionData();
        } else {
            showToast(data.error || 'Erro ao cancelar', 'error');
        }
    } catch (error) {
        console.error('[CANCEL_ERROR]', error);
        showToast('Erro ao cancelar assinatura', 'error');
    }
};
```

**2. `views/app.html` - Função `loadSubscriptionData` (linhas ~1135-1149)**

Atualizar label para diferenciar cancelamento:

```javascript
// Dentro da função loadSubscriptionData, seção que atualiza o label de renovação:
if (sub.endsAt) {
    const endsAt = new Date(sub.endsAt);
    let label;

    if (sub.status === 'trial' || sub.isTrialing) {
        label = 'Fim do trial';
    } else if (sub.isCanceled || sub.isCanceledAtPeriodEnd) {
        label = 'Acesso até';  // NOVO: label específico para cancelado
    } else {
        label = 'Próxima renovação';
    }

    document.getElementById('subRenewalLabel').textContent = label;
    document.getElementById('subRenewalDate').textContent = endsAt.toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    // NOVO: Adicionar classe visual para cancelado
    const renewalContainer = document.getElementById('subRenewalLabel')?.parentElement;
    if (renewalContainer) {
        renewalContainer.classList.toggle('canceled', sub.isCanceled || sub.isCanceledAtPeriodEnd);
    }
}
```

#### Critérios de Sucesso - Fase 2:

**Verificação Manual:**
- [ ] Ao cancelar assinatura, toast mostra data específica: "Você terá acesso até 15 de março de 2026"
- [ ] Na seção de assinatura, label muda de "Próxima renovação" para "Acesso até" quando cancelado
- [ ] Estilo visual diferencia estado cancelado

**Status:** Implementado - Aguardando verificação manual

---

### Fase 3: Frontend - Melhorar Banner de Trial no Dashboard

**Objetivo:** Tornar o banner de trial mais proeminente com contagem de dias destacada e CTA claro

#### Arquivos a Modificar:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `views/spa/dashboard.html` | Modificar | Melhorar visual do banner de trial |

#### Detalhes de Implementação:

**1. `views/spa/dashboard.html` - Banner de Trial (linhas ~1-40)**

Atualizar estrutura do banner para destacar dias restantes:

```html
<!-- Substituir o banner existente -->
<div class="trial-banner" id="trialBanner" style="display: none;">
    <div class="trial-banner-content">
        <div class="trial-banner-icon">
            <i class="fas fa-clock"></i>
        </div>
        <div class="trial-banner-text">
            <h3 id="trialBannerTitle">Período de teste</h3>
            <p id="trialBannerText">Aproveite todos os recursos PRO</p>
        </div>
        <!-- NOVO: Contagem de dias destacada -->
        <div class="trial-days-counter" id="trialDaysCounter">
            <span class="trial-days-number" id="trialDaysNumber">7</span>
            <span class="trial-days-label">dias restantes</span>
        </div>
    </div>
    <a href="/pricing" class="trial-banner-btn" id="trialBannerBtn">
        <i class="fas fa-rocket"></i>
        Fazer upgrade
    </a>
</div>
```

**2. `views/spa/dashboard.html` - Estilos do Banner**

Adicionar estilos para o contador de dias (na seção `<style>`):

```css
/* Contador de dias do trial */
.trial-days-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    margin-left: auto;
    margin-right: 16px;
}

.trial-days-number {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
}

.trial-days-label {
    font-size: 11px;
    text-transform: uppercase;
    opacity: 0.9;
}

/* Banner expirado - mais urgente */
.trial-banner.expired {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
}

.trial-banner.expired .trial-days-counter {
    background: rgba(0, 0, 0, 0.2);
}

.trial-banner.expired .trial-days-number {
    color: #fff;
}

/* Banner com poucos dias - alerta */
.trial-banner.warning {
    background: linear-gradient(135deg, #fd7e14 0%, #e55a00 100%);
}

/* Botão mais destacado quando expirado */
.trial-banner.expired .trial-banner-btn {
    background: #fff;
    color: #dc3545;
    font-weight: 600;
}

.trial-banner.expired .trial-banner-btn:hover {
    background: #f8f9fa;
    transform: scale(1.05);
}
```

**3. `views/spa/dashboard.html` - Lógica do Banner (linhas ~76-104)**

Atualizar função `showTrialBanner`:

```javascript
function showTrialBanner() {
    const banner = document.getElementById('trialBanner');
    const title = document.getElementById('trialBannerTitle');
    const text = document.getElementById('trialBannerText');
    const daysNumber = document.getElementById('trialDaysNumber');
    const daysLabel = document.getElementById('trialDaysLabel');
    const btn = document.getElementById('trialBannerBtn');
    const daysCounter = document.getElementById('trialDaysCounter');

    if (!banner) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const sub = user.subscription || {};

    // Resetar classes
    banner.classList.remove('expired', 'warning');

    if (sub.status === 'trial' && sub.days_remaining !== undefined) {
        banner.style.display = 'flex';
        daysCounter.style.display = 'flex';

        const days = Math.max(0, Math.floor(sub.days_remaining));
        daysNumber.textContent = days;

        if (days <= 1) {
            daysLabel.textContent = days === 1 ? 'dia restante' : 'dias restantes';
            title.textContent = 'Último dia de trial!';
            text.textContent = 'Faça upgrade agora para não perder acesso';
            banner.classList.add('warning');
        } else if (days <= 3) {
            daysLabel.textContent = 'dias restantes';
            title.textContent = 'Trial terminando';
            text.textContent = 'Aproveite para garantir seu plano PRO';
            banner.classList.add('warning');
        } else {
            daysLabel.textContent = 'dias restantes';
            title.textContent = 'Período de teste';
            text.textContent = 'Aproveite todos os recursos PRO';
        }

        btn.innerHTML = '<i class="fas fa-rocket"></i> Fazer upgrade';

    } else if (sub.status === 'expired') {
        banner.style.display = 'flex';
        banner.classList.add('expired');
        daysCounter.style.display = 'flex';

        daysNumber.textContent = '0';
        daysLabel.textContent = 'dias restantes';

        title.textContent = 'Trial expirado';
        text.textContent = 'Assine o plano PRO para continuar usando todos os recursos';
        btn.innerHTML = '<i class="fas fa-crown"></i> Assinar PRO agora';

    } else {
        banner.style.display = 'none';
    }
}

// Chamar na inicialização
document.addEventListener('DOMContentLoaded', showTrialBanner);
```

#### Critérios de Sucesso - Fase 3:

**Verificação Manual:**
- [ ] Banner mostra contagem de dias de forma destacada (número grande)
- [ ] Banner muda de cor para laranja quando restam 3 dias ou menos
- [ ] Banner muda para vermelho quando trial expira
- [ ] CTA muda para "Assinar PRO agora" quando expirado
- [ ] Botão tem destaque visual maior quando expirado

**Status:** Implementado - Aguardando verificação manual

---

## Arquivos Afetados (Resumo)

### Novos Arquivos:
- Nenhum

### Arquivos Modificados:
- `routes/billing.js` - Retornar dados de cancelamento no endpoint
- `database.js` - Adicionar flags de cancelamento em `getSubscriptionInfo`
- `views/app.html` - Toast com data e label de cancelamento
- `views/spa/dashboard.html` - Banner de trial melhorado

---

## Variáveis de Ambiente

Nenhuma nova variável necessária.

---

## Considerações de Segurança

- [x] Dados de cancelamento já são protegidos por `authMiddleware`
- [x] Não expõe informações sensíveis adicionais
- [x] Validação de input já existe nos endpoints
- [x] SQL injection prevenido (queries parametrizadas)

---

## Edge Cases

| Cenário | Comportamento Esperado |
|---------|----------------------|
| Usuário cancela e `subscription_ends_at` é null | Toast mostra mensagem genérica sem data |
| Trial com 0 dias restantes | Banner mostra "0 dias restantes" e estado expirado |
| Usuário reativa assinatura após cancelar | Label volta para "Próxima renovação" |
| `localStorage.user.subscription` vazio | Banner não é exibido |
| Cancelamento imediato (`immediate: true`) | Toast mostra "Assinatura cancelada imediatamente" |

---

## Rollback

Em caso de problemas:

1. Reverter código via git: `git checkout -- routes/billing.js database.js views/app.html views/spa/dashboard.html`
2. Não há migrações de banco, então não precisa reverter dados

---

## Checklist Final

- [x] Fase 1: Backend retorna dados de cancelamento
- [x] Fase 2: Frontend exibe data de cancelamento corretamente
- [x] Fase 3: Banner de trial melhorado com contador de dias
- [x] Servidor inicia sem erros
- [ ] Testes manuais passando
- [x] Variáveis de ambiente configuradas (já existentes)
