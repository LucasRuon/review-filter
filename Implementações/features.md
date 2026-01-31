# Features: Integração WhatsApp por Cliente

## Resumo Executivo

Este documento detalha as features a serem implementadas para vincular instâncias do WhatsApp a clientes específicos, com sistema de cobrança via Stripe.

---

## 1. ANÁLISE DO ESTADO ATUAL

### O que já existe

#### Tabela `integrations` (ATUAL - POR USUÁRIO)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER UNIQUE  -- ⚠️ Vinculada ao USUÁRIO, não ao cliente
whatsapp_number TEXT
whatsapp_message TEXT
whatsapp_instance_name TEXT
whatsapp_token TEXT
whatsapp_status TEXT (default: 'disconnected')
whatsapp_qrcode TEXT
whatsapp_send_to_type TEXT ('contact' or 'group')
whatsapp_send_to_jid TEXT
webhook_url TEXT
webhook_header TEXT
whatsapp_notify_new_complaint INTEGER (default: 1)
whatsapp_notify_status_change INTEGER (default: 1)
whatsapp_message_in_progress TEXT
whatsapp_message_resolved TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Problema**: A integração atual é 1:1 (um usuário = uma instância WhatsApp). Não há suporte para múltiplos clientes com instâncias separadas.

#### Tabela `users` - Campos Stripe (JÁ EXISTEM)
```sql
subscription_status TEXT (default: 'free')
subscription_plan TEXT (default: 'free')
stripe_customer_id TEXT
stripe_subscription_id TEXT
subscription_ends_at TIMESTAMP
```

#### Serviço WhatsApp (`services/whatsapp-service.js`)
- ✅ Criação de instâncias via UAZAPI
- ✅ Conexão via QR Code
- ✅ Envio de mensagens
- ✅ Listagem de grupos
- ✅ Webhook para status
- ✅ Templates de mensagem com variáveis

#### Rotas WhatsApp (`routes/whatsapp.js`)
- ✅ CRUD de instância
- ✅ Configuração de notificações
- ⚠️ Vinculado ao `userId`, não `clientId`

---

## 2. FEATURES A IMPLEMENTAR

### 2.1 Nova Arquitetura de Banco de Dados

#### Nova Tabela: `whatsapp_instances`
```sql
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,

    -- Dados da instância UAZAPI
    instance_name TEXT NOT NULL,
    instance_token TEXT,
    status TEXT DEFAULT 'disconnected',
    qrcode TEXT,

    -- Configurações de envio
    send_to_type TEXT DEFAULT 'contact', -- 'contact' ou 'group'
    send_to_jid TEXT,

    -- Templates de mensagem
    message_new_complaint TEXT,
    message_in_progress TEXT,
    message_resolved TEXT,

    -- Configurações de notificação
    notify_new_complaint INTEGER DEFAULT 1,
    notify_status_change INTEGER DEFAULT 1,

    -- Billing
    is_free INTEGER DEFAULT 0, -- 1 = instância gratuita do plano
    stripe_subscription_item_id TEXT, -- Item específico da subscription
    price_monthly DECIMAL(10,2) DEFAULT 39.90,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(user_id, client_id), -- Cada cliente pode ter apenas 1 instância
    UNIQUE(instance_name)
);

CREATE INDEX idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
CREATE INDEX idx_whatsapp_instances_client_id ON whatsapp_instances(client_id);
CREATE INDEX idx_whatsapp_instances_status ON whatsapp_instances(status);
```

#### Migração da tabela `integrations`
A tabela `integrations` atual será mantida apenas para `webhook_url` e `webhook_header` (configurações gerais do usuário).

```sql
-- Remover colunas de WhatsApp da tabela integrations (após migração)
ALTER TABLE integrations
DROP COLUMN IF EXISTS whatsapp_number,
DROP COLUMN IF EXISTS whatsapp_message,
DROP COLUMN IF EXISTS whatsapp_instance_name,
DROP COLUMN IF EXISTS whatsapp_token,
DROP COLUMN IF EXISTS whatsapp_status,
DROP COLUMN IF EXISTS whatsapp_qrcode,
DROP COLUMN IF EXISTS whatsapp_send_to_type,
DROP COLUMN IF EXISTS whatsapp_send_to_jid,
DROP COLUMN IF EXISTS whatsapp_notify_new_complaint,
DROP COLUMN IF EXISTS whatsapp_notify_status_change,
DROP COLUMN IF EXISTS whatsapp_message_in_progress,
DROP COLUMN IF EXISTS whatsapp_message_resolved;
```

---

### 2.2 Lógica de Negócio

#### Regras de Instâncias

| Cenário | Comportamento |
|---------|---------------|
| Usuário cria 1º cliente | Ganha 1 instância gratuita |
| Usuário quer 2ª instância | Deve pagar R$ 39,90/mês |
| Usuário cancela cliente | Instância fica sem vínculo (pode revincular) |
| Usuário cancela instância paga | Cancela item no Stripe |
| Usuário no plano Free | Máximo 1 cliente, 1 instância gratuita |
| Usuário no plano Pro | Máximo 10 clientes, 1 instância gratuita + pagas |

#### Fluxo de Criação de Instância

```
1. Usuário acessa Integrações
2. Sistema verifica: tem instância gratuita disponível?
   - SIM: Pode criar sem cobrança (is_free = 1)
   - NÃO: Mostra botão "Adicionar Instância (+R$ 39,90/mês)"
3. Ao clicar em adicionar:
   a. Criar Checkout Session no Stripe
   b. Redirecionar para pagamento
   c. Webhook do Stripe confirma pagamento
   d. Sistema cria instância na UAZAPI
   e. Vincula ao cliente selecionado
4. Usuário escaneia QR Code
5. Instância conectada e pronta para uso
```

#### Fluxo de Vinculação

```
1. Usuário vai em Integrações > WhatsApp
2. Lista todas as instâncias do usuário:
   - Instância 1 (Gratuita) → Cliente: "Restaurante X" [Conectado]
   - Instância 2 (R$ 39,90/mês) → Cliente: "Loja Y" [Desconectado]
   - [+ Adicionar Nova Instância]
3. Cada instância tem dropdown para selecionar cliente
4. Apenas clientes sem instância aparecem no dropdown
5. Ao vincular, configurar mensagens automáticas
```

---

### 2.3 Novos Endpoints da API

#### Instâncias WhatsApp

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/whatsapp/instances` | Listar todas instâncias do usuário |
| POST | `/api/whatsapp/instances` | Criar nova instância |
| GET | `/api/whatsapp/instances/:id` | Detalhes de uma instância |
| PUT | `/api/whatsapp/instances/:id` | Atualizar instância (vincular cliente, config) |
| DELETE | `/api/whatsapp/instances/:id` | Remover instância |
| POST | `/api/whatsapp/instances/:id/connect` | Gerar QR Code |
| GET | `/api/whatsapp/instances/:id/status` | Status da conexão |
| POST | `/api/whatsapp/instances/:id/disconnect` | Desconectar |
| POST | `/api/whatsapp/instances/:id/send-test` | Enviar mensagem de teste |
| GET | `/api/whatsapp/instances/:id/groups` | Listar grupos da instância |

#### Stripe/Billing

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/billing/create-checkout` | Criar sessão de checkout para instância |
| POST | `/api/billing/webhook` | Webhook do Stripe |
| GET | `/api/billing/portal` | Portal de gerenciamento Stripe |
| GET | `/api/billing/invoices` | Listar faturas |

---

### 2.4 Integração Stripe

#### Configuração Necessária

```javascript
// Variáveis de ambiente
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_WHATSAPP_INSTANCE=price_... // Preço mensal de R$ 39,90
```

#### Fluxo de Checkout

```javascript
// POST /api/billing/create-checkout
const session = await stripe.checkout.sessions.create({
    customer: user.stripe_customer_id, // ou criar novo
    mode: 'subscription',
    line_items: [{
        price: process.env.STRIPE_PRICE_WHATSAPP_INSTANCE,
        quantity: 1,
    }],
    metadata: {
        user_id: userId,
        client_id: clientId, // cliente a ser vinculado
        type: 'whatsapp_instance'
    },
    success_url: `${BASE_URL}/app#integrations?success=true`,
    cancel_url: `${BASE_URL}/app#integrations?canceled=true`,
});
```

#### Webhook Events

```javascript
// POST /api/billing/webhook
switch (event.type) {
    case 'checkout.session.completed':
        // Criar instância WhatsApp
        // Vincular ao cliente
        break;

    case 'customer.subscription.deleted':
        // Desativar instância
        // Notificar usuário
        break;

    case 'invoice.payment_failed':
        // Marcar instância como pendente
        // Enviar email de aviso
        break;
}
```

---

### 2.5 Alterações no Frontend

#### Tela de Integrações (`views/spa/integrations.html`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Integrações                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📱 WhatsApp Business                                        │ │
│ │                                                             │ │
│ │ Suas Instâncias:                                            │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Instância 1 (Gratuita)                    🟢 Conectado  │ │ │
│ │ │ Cliente: [Restaurante Sabor    ▼]                       │ │ │
│ │ │ Número: +55 11 99999-9999                               │ │ │
│ │ │ [Configurar] [Desconectar]                              │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Instância 2 (R$ 39,90/mês)              🔴 Desconectado │ │ │
│ │ │ Cliente: [Loja Fashion        ▼]                        │ │ │
│ │ │ [Conectar] [Configurar] [Remover]                       │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ [+ Adicionar Nova Instância]            R$ 39,90/mês    │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔗 Webhook (Configuração Global)                           │ │
│ │ URL: [_________________________________]                   │ │
│ │ Header: [_________________________________]                │ │
│ │ [Testar Webhook]                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Modal de Configuração da Instância

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚙️ Configurar Instância                                    [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Cliente Vinculado: [Restaurante Sabor ▼]                        │
│                                                                  │
│ Enviar notificações para:                                       │
│ ○ Contato específico: [+55 11 99999-9999]                      │
│ ○ Grupo do WhatsApp: [Selecionar grupo ▼]                      │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Mensagens Automáticas:                                          │
│                                                                  │
│ Nova Reclamação: [✓]                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔔 Nova reclamação recebida!                                │ │
│ │ Cliente: {cliente}                                          │ │
│ │ Nome: {nome}                                                │ │
│ │ Tópico: {topico}                                            │ │
│ │ Mensagem: {reclamacao}                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Mudança de Status: [✓]                                          │
│ Em Andamento:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Olá {nome}, sua solicitação está sendo analisada...        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Resolvido:                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Olá {nome}, sua solicitação foi resolvida!                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                              [Cancelar] [Salvar Configurações]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. ARQUIVOS A MODIFICAR/CRIAR

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `routes/billing.js` | Endpoints do Stripe (checkout, webhook, portal) |
| `services/stripe-service.js` | Serviço de integração com Stripe |
| `migrations/001_whatsapp_instances.sql` | Script de migração do banco |

### Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `database.js` | Adicionar CRUD para `whatsapp_instances` |
| `routes/whatsapp.js` | Refatorar para usar nova arquitetura |
| `services/whatsapp-service.js` | Adaptar para múltiplas instâncias |
| `routes/review.js` | Buscar instância do cliente específico |
| `routes/clients.js` | Buscar instância ao notificar mudança de status |
| `views/spa/integrations.html` | Nova interface com múltiplas instâncias |
| `views/app.html` | JavaScript para gerenciar instâncias |
| `server.js` | Adicionar rotas de billing |
| `.env.example` | Adicionar variáveis do Stripe |

---

## 4. PLANO DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados (Prioridade Alta)
1. Criar tabela `whatsapp_instances`
2. Migrar dados existentes da tabela `integrations`
3. Adicionar funções CRUD no `database.js`

### Fase 2: Backend WhatsApp (Prioridade Alta)
1. Refatorar `routes/whatsapp.js` para nova arquitetura
2. Atualizar `whatsapp-service.js`
3. Atualizar lógica de notificação em `review.js`
4. Atualizar lógica de status em `clients.js`

### Fase 3: Integração Stripe (Prioridade Alta)
1. Criar `services/stripe-service.js`
2. Criar `routes/billing.js`
3. Implementar checkout flow
4. Implementar webhook handlers
5. Testar com Stripe Test Mode

### Fase 4: Frontend (Prioridade Média)
1. Redesenhar `integrations.html`
2. Adicionar JavaScript para gerenciamento
3. Implementar modal de configuração
4. Adicionar feedback visual (loading, success, error)

### Fase 5: Testes e Deploy (Prioridade Alta)
1. Testes de integração
2. Testes de pagamento (sandbox)
3. Migração de dados em produção
4. Monitoramento pós-deploy

---

## 5. CONSIDERAÇÕES TÉCNICAS

### Backward Compatibility
- Manter tabela `integrations` funcionando durante migração
- Script de migração deve copiar dados existentes
- Feature flag para habilitar nova arquitetura gradualmente

### Performance
- Cache de instâncias por cliente (60s TTL)
- Índices otimizados na nova tabela
- Webhook do Stripe com retry automático

### Segurança
- Validar ownership em todas operações
- Stripe webhook signature verification
- Não expor tokens da UAZAPI no frontend

### Monitoramento
- Log de todas operações de billing
- Alertas para falhas de pagamento
- Dashboard admin com métricas de instâncias

---

## 6. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# Stripe (NOVAS)
STRIPE_SECRET_KEY=sk_live_... ou sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_live_... ou pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_WHATSAPP_INSTANCE=price_... # ID do preço no Stripe

# WhatsApp (EXISTENTES)
WHATSAPP_API_URL=https://audeagencia.uazapi.com
WHATSAPP_ADMIN_TOKEN=...

# Base URL (EXISTENTE)
BASE_URL=https://app.opinaja.com.br
```

---

## 7. ESTRUTURA DE PREÇOS

| Item | Preço | Recorrência |
|------|-------|-------------|
| Instância WhatsApp (adicional) | R$ 39,90 | Mensal |
| Primeira instância | Gratuita | Incluída no plano |

### Produto no Stripe
```json
{
  "name": "Instância WhatsApp Adicional",
  "description": "Instância adicional do WhatsApp para integração com outro cliente",
  "default_price": {
    "unit_amount": 3990,
    "currency": "brl",
    "recurring": {
      "interval": "month"
    }
  }
}
```

---

## 8. FLUXOGRAMA DE DECISÃO

```
                    ┌──────────────────┐
                    │ Usuário acessa   │
                    │   Integrações    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Buscar instâncias│
                    │   do usuário     │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────────┐     │     ┌────────▼────────┐
     │ Tem instância   │     │     │ Não tem nenhuma │
     │    gratuita?    │     │     │   instância     │
     └────────┬────────┘     │     └────────┬────────┘
              │              │              │
        ┌─────┴─────┐        │        ┌─────▼─────┐
        │           │        │        │  Mostrar  │
   ┌────▼────┐ ┌────▼────┐   │        │ "Criar 1ª │
   │   SIM   │ │   NÃO   │   │        │ instância │
   └────┬────┘ └────┬────┘   │        │ gratuita" │
        │           │        │        └───────────┘
        │           │        │
   ┌────▼────────────▼────┐  │
   │ Mostrar instâncias   │  │
   │ + botão "Adicionar   │  │
   │   (+R$ 39,90/mês)"   │  │
   └──────────────────────┘  │
                             │
              ┌──────────────▼──────────────┐
              │     Ao clicar "Adicionar"   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │ É a primeira instância?     │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐   ┌─────▼─────┐
         │   SIM   │   │    NÃO    │
         └────┬────┘   └─────┬─────┘
              │              │
    ┌─────────▼─────────┐    │
    │ Criar instância   │    │
    │ gratuita          │    │
    │ (is_free = 1)     │    │
    └─────────┬─────────┘    │
              │              │
              │    ┌─────────▼─────────┐
              │    │ Redirecionar para │
              │    │ Stripe Checkout   │
              │    └─────────┬─────────┘
              │              │
              │    ┌─────────▼─────────┐
              │    │ Webhook confirma  │
              │    │ pagamento         │
              │    └─────────┬─────────┘
              │              │
              │    ┌─────────▼─────────┐
              │    │ Criar instância   │
              │    │ paga              │
              │    │ (is_free = 0)     │
              │    └─────────┬─────────┘
              │              │
              └──────┬───────┘
                     │
           ┌─────────▼─────────┐
           │ Mostrar QR Code   │
           │ para conectar     │
           └─────────┬─────────┘
                     │
           ┌─────────▼─────────┐
           │ Selecionar cliente│
           │ para vincular     │
           └─────────┬─────────┘
                     │
           ┌─────────▼─────────┐
           │ Instância pronta  │
           │ para uso!         │
           └───────────────────┘
```

---

## 9. CHECKLIST DE IMPLEMENTAÇÃO

### Banco de Dados
- [ ] Criar tabela `whatsapp_instances`
- [ ] Criar índices necessários
- [ ] Script de migração de dados existentes
- [ ] Funções CRUD em `database.js`

### Backend
- [ ] Refatorar `routes/whatsapp.js`
- [ ] Criar `routes/billing.js`
- [ ] Criar `services/stripe-service.js`
- [ ] Atualizar `services/whatsapp-service.js`
- [ ] Atualizar `routes/review.js` (notificação por cliente)
- [ ] Atualizar `routes/clients.js` (status por cliente)
- [ ] Webhook do Stripe

### Frontend
- [ ] Nova interface `integrations.html`
- [ ] Modal de configuração
- [ ] Integração com Stripe Checkout
- [ ] Feedback visual (loading, errors)
- [ ] Responsividade mobile

### Configuração
- [ ] Criar produto/preço no Stripe
- [ ] Configurar webhook no Stripe
- [ ] Adicionar variáveis de ambiente
- [ ] Atualizar `.env.example`

### Testes
- [ ] Teste de criação de instância gratuita
- [ ] Teste de checkout Stripe (sandbox)
- [ ] Teste de webhook Stripe
- [ ] Teste de vinculação cliente-instância
- [ ] Teste de envio de mensagens
- [ ] Teste de cancelamento

### Deploy
- [ ] Migração de banco em produção
- [ ] Deploy do código
- [ ] Configurar Stripe em produção
- [ ] Monitoramento ativo

---

## 10. ESTIMATIVA DE COMPLEXIDADE

| Componente | Complexidade | Dependências |
|------------|--------------|--------------|
| Tabela `whatsapp_instances` | Baixa | Nenhuma |
| Migração de dados | Média | Tabela criada |
| CRUD database.js | Média | Tabela criada |
| Refatorar rotas WhatsApp | Alta | CRUD pronto |
| Integração Stripe | Alta | Conta Stripe |
| Frontend | Média | Backend pronto |
| Testes | Média | Tudo pronto |

---

*Documento gerado em: 2026-01-30*
*Versão: 1.0*
