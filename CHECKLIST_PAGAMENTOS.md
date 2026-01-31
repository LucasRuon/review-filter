# ✅ Checklist: Sistema de Pagamentos Pronto?

**Data:** 31/01/2026

---

## 📊 Status Atual

### ✅ O Que Já Funciona (Backend Completo)

1. **✅ Trial Automático**
   - Novos usuários ganham 14 dias PRO automaticamente
   - Status, data de início e fim são salvos
   - Customer criado no Stripe

2. **✅ Proteção de Funcionalidades**
   - Trial expirado bloqueia ações (criar, editar, deletar)
   - Limites por plano são respeitados (PRO = 10 clientes)
   - Leitura continua funcionando

3. **✅ APIs de Billing**
   - `GET /api/billing/subscription` - Ver status da assinatura
   - `POST /api/billing/subscribe` - Criar checkout
   - `GET /api/billing/plans` - Listar planos
   - `POST /api/billing/cancel` - Cancelar
   - `POST /api/billing/reactivate` - Reativar

4. **✅ Integração Stripe (Básica)**
   - Chaves configuradas (PRODUÇÃO!)
   - Produto Starter criado
   - Price ID configurado

5. **✅ Jobs Agendados**
   - Lembretes de trial (3 e 1 dia antes)
   - Expiração automática de trials
   - Sincronização com Stripe

---

## ⚠️ O Que FALTA Para Aceitar Pagamentos

### 🔴 CRÍTICO - Webhook do Stripe

**Status:** ❌ NÃO CONFIGURADO

**Por que é importante:**
- Sem webhook, pagamentos NÃO ativam assinaturas automaticamente
- Cliente paga mas continua bloqueado
- Você não recebe notificações de cancelamento, falha de pagamento, etc.

**Como resolver:**

#### Para Desenvolvimento Local (Agora):
```bash
# 1. Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# 2. Fazer login
stripe login

# 3. Rodar forward (deixar rodando em um terminal)
stripe listen --forward-to localhost:3000/api/billing/webhook

# 4. Copiar o whsec_xxxxx que aparecer
# 5. Adicionar no .env:
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# 6. Reiniciar servidor
npm start
```

#### Para Produção (Quando fizer deploy):
1. Deploy do código na Railway
2. Stripe Dashboard → Webhooks → Add endpoint
3. URL: `https://SEU_DOMINIO.railway.app/api/billing/webhook`
4. Eventos:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.paid
   - invoice.payment_failed
5. Copiar webhook secret
6. Adicionar nas variáveis de ambiente da Railway

---

### 🟡 IMPORTANTE - Interface do Usuário

**Status:** ❌ NÃO IMPLEMENTADO

**O que falta:**

1. **Banner de Trial**
   - Usuário não vê quanto tempo resta
   - Não tem botão de upgrade visível

2. **Modal de Bloqueio**
   - Quando trial expira, usuário vê apenas erro 403
   - Não aparece opção de fazer upgrade

3. **Página /pricing**
   - Não existe página mostrando planos
   - Usuário não sabe quanto custa

4. **Interceptador 403**
   - Erros de subscription não mostram modal bonito

**Impacto:**
- ⚠️ Usuários podem comprar via API direta
- ⚠️ Mas experiência é ruim (sem interface)
- ⚠️ Taxa de conversão será baixa

**Como resolver:**
- Implementar Fase 10 (4-6 horas de trabalho)
- Ou criar páginas básicas primeiro

---

### 🟡 RECOMENDADO - Mais Planos

**Status:** ⚠️ PARCIAL

Você tem:
- ✅ Starter Mensal: `price_1SowDo1T9tv9oH8YxTfwyXgP`
- ❌ Starter Anual: não criado
- ❌ Enterprise: não criado

**Impacto:**
- Usuários só podem assinar plano mensal
- Sem desconto anual (menos receita)
- Sem opção Enterprise

**Como resolver:**
1. Criar preços no Stripe Dashboard
2. Atualizar no banco (SQL ready em `configure-prices.sql`)

---

## 🧪 Teste Completo do Fluxo

### Teste 1: Criar Usuário com Trial ✅

```bash
# Via interface
http://localhost:3000/register

# Ou via API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@test.com","password":"123456"}'
```

**Resultado esperado:**
- ✅ Usuário criado
- ✅ subscription_status = 'trial'
- ✅ subscription_plan = 'pro'
- ✅ subscription_ends_at = hoje + 14 dias

---

### Teste 2: Ver Planos Disponíveis ✅

```bash
curl http://localhost:3000/api/billing/plans
```

**Resultado esperado:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "pro",
      "price_monthly": 97.00,
      "price_id_monthly": "price_1SowDo1T9tv9oH8YxTfwyXgP"
    }
  ]
}
```

---

### Teste 3: Criar Checkout ✅

```bash
# Fazer login primeiro e pegar o cookie token
curl -X POST http://localhost:3000/api/billing/subscribe \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN" \
  -d '{"plan":"pro","billing_cycle":"monthly"}'
```

**Resultado esperado:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/..."
}
```

---

### Teste 4: Completar Pagamento ❌ (SEM WEBHOOK)

**O que acontece AGORA (sem webhook):**
1. ✅ Usuário clica na URL do checkout
2. ✅ Paga no Stripe
3. ✅ Stripe processa pagamento
4. ❌ Webhook NÃO funciona (não configurado)
5. ❌ Assinatura NÃO é ativada
6. ❌ Usuário paga mas continua bloqueado

**O que deveria acontecer (com webhook):**
1. ✅ Usuário clica na URL
2. ✅ Paga no Stripe
3. ✅ Stripe envia webhook
4. ✅ Sistema recebe e ativa assinatura
5. ✅ subscription_status = 'active'
6. ✅ Usuário tem acesso liberado

---

## 🚨 Problemas Atuais

### 1. Pagamentos NÃO Ativam Automaticamente ❌

**Causa:** Webhook não configurado
**Solução:** Configurar webhook (ver acima)

### 2. Você Está em PRODUÇÃO! ⚠️

Suas chaves são **LIVE**:
- `sk_live_...`
- `pk_live_...`

**Isso significa:**
- ⚠️ Pagamentos são REAIS
- ⚠️ Clientes serão COBRADOS de verdade
- ⚠️ Você precisa estar PRONTO para suporte

**Recomendação:** Usar modo TESTE primeiro!
```env
# Trocar no .env para chaves de teste
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Sem Interface Visual ⚠️

Usuários não vão:
- Ver quanto tempo resta de trial
- Saber onde fazer upgrade
- Ver planos e preços

**Solução:** Implementar Fase 10 (frontend)

---

## ✅ Checklist Para Aceitar Pagamentos

- [ ] **Webhook configurado** (CRÍTICO)
- [ ] **Testado em modo teste** (Recomendado)
- [ ] **Interface básica** (Banner + Pricing)
- [ ] **Termos de serviço** criados
- [ ] **Política de privacidade** criada
- [ ] **Política de reembolso** definida
- [ ] **Email de suporte** configurado
- [ ] **Customer Portal** configurado no Stripe
- [ ] **Testado fluxo completo** (registro → trial → pagamento → ativação)

---

## 🎯 Prioridades

### Prioridade 1 (AGORA - 30 min)
1. ✅ Configurar webhook para desenvolvimento
2. ✅ Testar fluxo completo de pagamento
3. ✅ Verificar se ativa corretamente

### Prioridade 2 (HOJE - 2h)
1. Mudar para modo TESTE do Stripe
2. Fazer vários testes de pagamento
3. Corrigir bugs se houver

### Prioridade 3 (ESTA SEMANA - 4-6h)
1. Criar página /pricing básica
2. Adicionar banner de trial
3. Adicionar modal de bloqueio

### Prioridade 4 (ANTES DE LANÇAR)
1. Criar termos de serviço
2. Criar política de privacidade
3. Configurar emails automáticos
4. Voltar para modo PRODUÇÃO

---

## 💡 Resposta Direta

### ❓ "Pessoas podem fazer compras agora?"

**Tecnicamente SIM, mas...**

✅ O que funciona:
- API de checkout gera URL de pagamento
- Stripe processa o pagamento
- Dinheiro entra na sua conta

❌ O que NÃO funciona:
- Assinatura não ativa automaticamente (falta webhook)
- Cliente paga mas continua bloqueado
- Você teria que ativar manualmente no banco

### ❓ "Está tudo ok?"

**Quase!** Falta:
1. 🔴 **Webhook** (CRÍTICO - 30 min)
2. 🟡 **Interface** (Importante - 4-6h)
3. 🟡 **Testes** (Recomendado - 2h)

### ❓ "O que falta?"

**Para aceitar pagamentos funcionais:**
- Configurar webhook (30 min) ← **FAÇA AGORA**

**Para lançar com qualidade:**
- Interface básica (4-6h)
- Testar em modo teste (2h)
- Termos e políticas (1-2h)

---

## 🚀 Próximo Passo Recomendado

**AGORA (30 minutos):**

```bash
# 1. Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# 2. Login
stripe login

# 3. Forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook

# 4. Copiar whsec_xxx e adicionar no .env

# 5. Testar pagamento completo
```

Depois disso, o sistema estará **100% funcional** para aceitar pagamentos!

---

**Resumo:** Você está a **30 minutos** de ter um sistema funcional de pagamentos! 🎯
