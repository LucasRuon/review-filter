# Features: Tela Profile - Dados de Plano e Assinatura

## Resumo Executivo

Este documento detalha o estado atual da tela de Profile e as features necessárias para implementar a exibição de dados de plano, assinatura e pagamento.

---

## 1. ESTADO ATUAL

### 1.1 Estrutura do Banco de Dados

#### Tabela `users` - Campos de Assinatura (JÁ EXISTEM)
**Localização:** `database.js:286-300`

```sql
subscription_status TEXT DEFAULT 'free'     -- Status: 'free', 'active', 'canceled', 'past_due'
subscription_plan TEXT DEFAULT 'free'       -- Plano: 'free', 'pro', 'enterprise'
stripe_customer_id TEXT                     -- ID do cliente no Stripe
stripe_subscription_id TEXT                 -- ID da assinatura no Stripe
subscription_ends_at TIMESTAMP              -- Data de fim/renovação da assinatura
```

**Status:** Campos criados mas NÃO UTILIZADOS - dados sempre retornam valores default.

#### Tabela `integrations` - WhatsApp (ATUAL)
**Localização:** `database.js:209-230`

```sql
-- Vinculada ao USUÁRIO (1:1), não ao cliente
user_id INTEGER UNIQUE
whatsapp_instance_name TEXT
whatsapp_token TEXT
whatsapp_status TEXT DEFAULT 'disconnected'
-- ... outros campos
```

**Limitação:** Apenas 1 instância WhatsApp por usuário.

---

### 1.2 Funções do Banco de Dados

#### Funções de Usuário Existentes
| Função | Localização | Retorna | Status |
|--------|-------------|---------|--------|
| `getUserById(id)` | database.js:512-518 | id, name, email, phone, created_at | Ativo |
| `getUserByIdWithStatus(id)` | database.js:521-527 | id, name, email, active | Ativo |
| `getUserByEmail(email)` | database.js:507-510 | Todos os campos | Ativo |

**Problema:** Nenhuma função retorna os campos de assinatura (`subscription_status`, `subscription_plan`, `stripe_customer_id`, etc.).

#### Funções de Assinatura
| Função | Status |
|--------|--------|
| `getUserSubscription(userId)` | **NÃO EXISTE** |
| `updateUserSubscription(userId, data)` | **NÃO EXISTE** |
| `getWhatsAppInstancesByUserId(userId)` | **NÃO EXISTE** |

---

### 1.3 Rotas da API

#### Rotas de Autenticação Existentes
**Localização:** `routes/auth.js`

| Método | Endpoint | Descrição | Status |
|--------|----------|-----------|--------|
| GET | `/api/auth/me` | Dados do usuário | **Retorna apenas: id, name, email, phone, created_at** |
| PUT | `/api/auth/profile` | Atualizar perfil | Funciona |
| PUT | `/api/auth/password` | Alterar senha | Funciona |

#### Rotas de Billing/Stripe
| Método | Endpoint | Descrição | Status |
|--------|----------|-----------|--------|
| GET | `/api/billing/subscription` | Info da assinatura | **NÃO EXISTE** |
| GET | `/api/billing/invoices` | Lista de faturas | **NÃO EXISTE** |
| POST | `/api/billing/portal` | Portal do Stripe | **NÃO EXISTE** |
| POST | `/api/billing/create-checkout` | Checkout Stripe | **NÃO EXISTE** |
| POST | `/api/billing/webhook` | Webhook Stripe | **NÃO EXISTE** |

#### Arquivo de Rotas
| Arquivo | Status |
|---------|--------|
| `routes/billing.js` | **NÃO EXISTE** |
| `services/stripe-service.js` | **NÃO EXISTE** |

---

### 1.4 Tela de Profile (Frontend)

#### Arquivo: `views/spa/profile.html`
**Linhas:** 1-87

**Componentes Atuais:**
- Foto de perfil (upload/remover)
- Dados pessoais (nome, email, telefone)
- Alterar senha

**Componentes Ausentes:**
- Dados do plano contratado
- Valor da assinatura
- Data da próxima renovação
- Dados do cartão de crédito
- Lista de instâncias WhatsApp
- Botão de upgrade/cancelar plano

#### Arquivo: `views/app.html`
**Função:** `loadProfileData()` (linha 1022-1033)

```javascript
async function loadProfileData() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.querySelector('[name="name"]').value = user.name || '';
    document.querySelector('[name="email"]').value = user.email || '';
    document.querySelector('[name="phone"]').value = user.phone || '';
    // ... apenas foto de perfil
}
```

**Problema:** Não busca dados de assinatura do servidor.

---

### 1.5 Serviços

#### Serviços Existentes
| Serviço | Arquivo | Status |
|---------|---------|--------|
| WhatsApp | `services/whatsapp-service.js` | Ativo |
| Email | `services/email-service.js` | Ativo |
| Cache | `services/cache-service.js` | Ativo |

#### Serviços Ausentes
| Serviço | Arquivo | Status |
|---------|---------|--------|
| Stripe | `services/stripe-service.js` | **NÃO EXISTE** |

---

## 2. FEATURES A IMPLEMENTAR

### 2.1 Dados do Plano na Tela Profile

#### Informações Necessárias
| Campo | Origem | Descrição |
|-------|--------|-----------|
| Plano atual | `users.subscription_plan` | Nome do plano (Free, Pro, Enterprise) |
| Status | `users.subscription_status` | Status da assinatura |
| Valor mensal | Stripe API ou config | R$ XX,XX/mês |
| Próxima renovação | `users.subscription_ends_at` | Data formatada |
| Cartão | Stripe API | Últimos 4 dígitos + bandeira |
| ID do cliente | `users.stripe_customer_id` | Para portal Stripe |

#### Informações de Instâncias WhatsApp
| Campo | Origem | Descrição |
|-------|--------|-----------|
| Total de instâncias | Nova tabela | Quantidade |
| Instância gratuita | `whatsapp_instances.is_free` | Se usa a gratuita |
| Instâncias pagas | Contagem | Quantidade de pagas |
| Valor adicional | Cálculo | N × R$ 39,90/mês |

---

### 2.2 Alterações no Banco de Dados

#### Nova Função: `getUserSubscriptionData(userId)`
**Proposta:**

```javascript
async function getUserSubscriptionData(userId) {
    const result = await pool.query(`
        SELECT
            id, name, email, phone,
            subscription_status,
            subscription_plan,
            stripe_customer_id,
            stripe_subscription_id,
            subscription_ends_at,
            created_at
        FROM users
        WHERE id = $1
    `, [userId]);
    return result.rows[0] || null;
}
```

#### Nova Tabela: `whatsapp_instances` (Documentada em features.md)
**Campos principais:**
- `id`, `user_id`, `client_id`
- `instance_name`, `instance_token`, `status`
- `is_free` (INTEGER) - Se é a instância gratuita
- `stripe_subscription_item_id` - Item no Stripe
- `price_monthly` - Valor mensal (R$ 39,90)

---

### 2.3 Novos Endpoints da API

#### Endpoint: GET `/api/billing/subscription`
**Resposta esperada:**

```json
{
    "plan": {
        "name": "Pro",
        "status": "active",
        "price": 9900,
        "currency": "brl",
        "interval": "month"
    },
    "subscription": {
        "id": "sub_xxxxx",
        "current_period_end": "2026-02-15T00:00:00Z",
        "cancel_at_period_end": false
    },
    "payment_method": {
        "type": "card",
        "brand": "visa",
        "last4": "4242",
        "exp_month": 12,
        "exp_year": 2028
    },
    "whatsapp_instances": {
        "total": 2,
        "free": 1,
        "paid": 1,
        "monthly_cost": 3990
    }
}
```

#### Endpoint: GET `/api/billing/invoices`
**Resposta esperada:**

```json
{
    "invoices": [
        {
            "id": "in_xxxxx",
            "amount_paid": 9900,
            "currency": "brl",
            "status": "paid",
            "created": "2026-01-15T00:00:00Z",
            "invoice_pdf": "https://stripe.com/..."
        }
    ]
}
```

#### Endpoint: POST `/api/billing/portal`
**Resposta esperada:**

```json
{
    "url": "https://billing.stripe.com/session/..."
}
```

---

### 2.4 Alterações no Frontend

#### Nova Seção na Tela Profile

```
┌─────────────────────────────────────────────────────────────────┐
│ Meu Perfil                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Foto de perfil]  [Dados pessoais]  [Alterar senha]             │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💳 Minha Assinatura                                         │ │
│ │                                                             │ │
│ │ Plano: Pro                              Status: ● Ativo     │ │
│ │ Valor: R$ 99,00/mês                                         │ │
│ │ Próxima renovação: 15 de Fevereiro de 2026                  │ │
│ │                                                             │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │                                                             │ │
│ │ Forma de pagamento:                                         │ │
│ │ 💳 Visa terminando em 4242                                  │ │
│ │                                                             │ │
│ │ [Gerenciar pagamento]  [Alterar plano]  [Ver faturas]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📱 Instâncias WhatsApp                                      │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Instância 1 (Gratuita)              🟢 Conectada        │ │ │
│ │ │ Cliente: Restaurante Sabor                              │ │ │
│ │ │ Criada em: 15/01/2026                                   │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Instância 2 (R$ 39,90/mês)          🔴 Desconectada     │ │ │
│ │ │ Cliente: Loja Fashion                                   │ │ │
│ │ │ Criada em: 20/01/2026                                   │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ Total adicional: R$ 39,90/mês                               │ │
│ │ [Gerenciar instâncias]                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. ARQUIVOS A MODIFICAR/CRIAR

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `routes/billing.js` | Endpoints de billing/Stripe |
| `services/stripe-service.js` | Integração com Stripe |
| `migrations/002_whatsapp_instances.sql` | Migração da nova tabela |

### Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `database.js` | Adicionar `getUserSubscriptionData()`, CRUD de `whatsapp_instances` |
| `routes/auth.js` | Modificar `/api/auth/me` para incluir dados de assinatura OU criar novo endpoint |
| `views/spa/profile.html` | Adicionar seção de assinatura e instâncias WhatsApp |
| `views/app.html` | Modificar `loadProfileData()` para buscar dados de billing |
| `server.js` | Registrar novas rotas de billing |
| `.env.example` | Adicionar variáveis do Stripe |

---

## 4. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# Stripe (A ADICIONAR)
STRIPE_SECRET_KEY=sk_live_... ou sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_live_... ou pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_PLAN=price_... # ID do preço do plano Pro
STRIPE_PRICE_WHATSAPP_INSTANCE=price_... # ID do preço da instância adicional

# WhatsApp (JÁ EXISTEM)
WHATSAPP_API_URL=https://audeagencia.uazapi.com
WHATSAPP_ADMIN_TOKEN=...

# Base URL (JÁ EXISTE)
BASE_URL=https://app.opinaja.com.br
```

---

## 5. ESTRUTURA DE PLANOS

### Planos Disponíveis

| Plano | Preço | Clientes | WhatsApp | Recursos |
|-------|-------|----------|----------|----------|
| Free | R$ 0 | 1 | 1 gratuita | Básico |
| Pro | R$ 99/mês | 10 | 1 gratuita + pagas | Completo |
| Enterprise | Sob consulta | Ilimitado | Ilimitado | Personalizado |

### Instância WhatsApp Adicional

| Item | Preço | Recorrência |
|------|-------|-------------|
| Instância adicional | R$ 39,90 | Mensal |

---

## 6. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados
- [ ] Criar função `getUserSubscriptionData(userId)`
- [ ] Criar tabela `whatsapp_instances`
- [ ] Criar funções CRUD para `whatsapp_instances`
- [ ] Migrar dados existentes de `integrations`

### Fase 2: Stripe Service
- [ ] Criar `services/stripe-service.js`
- [ ] Implementar `getSubscription(customerId)`
- [ ] Implementar `getPaymentMethod(customerId)`
- [ ] Implementar `getInvoices(customerId)`
- [ ] Implementar `createPortalSession(customerId)`

### Fase 3: API Routes
- [ ] Criar `routes/billing.js`
- [ ] Endpoint GET `/api/billing/subscription`
- [ ] Endpoint GET `/api/billing/invoices`
- [ ] Endpoint POST `/api/billing/portal`
- [ ] Registrar rotas em `server.js`

### Fase 4: Frontend - Profile
- [ ] Atualizar `views/spa/profile.html` com seção de assinatura
- [ ] Atualizar `views/spa/profile.html` com seção de instâncias WhatsApp
- [ ] Atualizar `loadProfileData()` em `views/app.html`
- [ ] Adicionar funções para gerenciar assinatura
- [ ] Adicionar função para abrir portal Stripe

### Fase 5: Testes
- [ ] Testar exibição de dados do plano Free
- [ ] Testar exibição de dados do plano Pro (sandbox)
- [ ] Testar abertura do portal Stripe
- [ ] Testar listagem de faturas
- [ ] Testar listagem de instâncias WhatsApp

---

## 7. MAPEAMENTO COMPLETO DE ARQUIVOS

### Estrutura do Projeto

```
review-filter/
├── server.js .......................... Servidor principal
│   ├── Linha 241-245 .................. Rotas registradas
│   └── Linha 541-543 .................. Rota /profile → app.html
│
├── database.js ........................ Banco de dados
│   ├── Linhas 139-146 ................. Tabela users
│   ├── Linhas 286-300 ................. Campos de assinatura
│   ├── Linhas 209-230 ................. Tabela integrations
│   ├── Linhas 498-518 ................. Funções de usuário
│   └── Linhas 909-1015 ................ Funções de integrations
│
├── routes/
│   ├── auth.js ........................ Autenticação
│   │   ├── Linhas 96-106 .............. GET /api/auth/me
│   │   └── Linhas 108-127 ............. PUT /api/auth/profile
│   ├── clients.js ..................... Clientes e reclamações
│   ├── whatsapp.js .................... WhatsApp (por usuário)
│   ├── admin.js ....................... Painel admin
│   └── billing.js ..................... A CRIAR
│
├── services/
│   ├── whatsapp-service.js ............ Integração WhatsApp
│   ├── email-service.js ............... Envio de emails
│   ├── cache-service.js ............... Cache em memória
│   └── stripe-service.js .............. A CRIAR
│
├── middleware/
│   └── auth.js ........................ Autenticação JWT
│
├── views/
│   ├── app.html ....................... SPA principal
│   │   ├── Linhas 1022-1033 ........... loadProfileData()
│   │   └── Linhas 137-144 ............. Rotas SPA
│   └── spa/
│       ├── profile.html ............... Tela de perfil (A MODIFICAR)
│       ├── integrations.html .......... Integrações WhatsApp
│       └── ... outras páginas
│
├── features.md ........................ Spec de WhatsApp por cliente
└── features_profile.md ................ ESTE ARQUIVO
```

---

## 8. DEPENDÊNCIAS A ADICIONAR

### package.json

```json
{
  "dependencies": {
    "stripe": "^14.x.x"  // A adicionar
  }
}
```

**Instalação:**
```bash
npm install stripe
```

---

## 9. PRÓXIMOS PASSOS

1. **Prioridade Alta:** Criar `services/stripe-service.js` e `routes/billing.js`
2. **Prioridade Alta:** Atualizar `database.js` com funções de assinatura
3. **Prioridade Média:** Atualizar `views/spa/profile.html`
4. **Prioridade Média:** Atualizar `views/app.html` (loadProfileData)
5. **Baixa Prioridade:** Implementar tabela `whatsapp_instances`

---

*Documento gerado em: 2026-01-30*
*Versão: 1.0*
*Baseado na análise completa do codebase review-filter*
