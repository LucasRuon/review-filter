# Guia de Deploy - Sistema de Subscription com Trial

**Data:** 31/01/2026
**Desenvolvido por:** Claude (Assistente AI)
**Status:** Pronto para Deploy

---

## 📋 Pré-requisitos

- [x] Node.js instalado
- [x] PostgreSQL rodando
- [x] Conta no Stripe configurada
- [x] Acesso ao servidor de produção
- [x] Backup do banco de dados atual

---

## 🚀 Passo a Passo do Deploy

### ETAPA 1: Backup (CRÍTICO)

```bash
# Fazer backup do banco de dados
pg_dump $DATABASE_URL > backup_pre_subscription_$(date +%Y%m%d_%H%M%S).sql

# Fazer backup do código
cd /Users/lucasruon/Downloads/review-filter
tar -czf backup_codigo_$(date +%Y%m%d_%H%M%S).tar.gz .
```

---

### ETAPA 2: Instalar Dependências

```bash
cd /Users/lucasruon/Downloads/review-filter

# Instalar node-cron
npm install node-cron

# Verificar instalação
npm list node-cron
```

---

### ETAPA 3: Executar Migrations

```bash
# Conectar ao banco e executar migrations em ordem

psql $DATABASE_URL -f migrations/002_subscription_fields.sql
psql $DATABASE_URL -f migrations/003_subscription_history.sql
psql $DATABASE_URL -f migrations/004_invoices.sql
psql $DATABASE_URL -f migrations/005_platform_settings.sql

# Verificar se as migrations foram aplicadas
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('trial_started_at', 'billing_email', 'cancellation_reason');"

# Deve retornar as 3 colunas
```

---

### ETAPA 4: Configurar Produtos no Stripe

#### 4.1 Acessar Stripe Dashboard
1. Ir para: https://dashboard.stripe.com/products
2. Clicar em "+ Add Product"

#### 4.2 Criar Produto PRO
- **Name:** Opina Já - PRO
- **Description:** Plano profissional com até 10 clientes
- **Pricing:**
  - Mensal: R$ 97,00 (recurring monthly)
  - Anual: R$ 931,20 (recurring yearly - 20% desconto)

**Copiar Price IDs:**
- `price_XXXXX` (monthly) → guardar
- `price_YYYYY` (yearly) → guardar

#### 4.3 Criar Produto Enterprise
- **Name:** Opina Já - Enterprise
- **Description:** Plano empresarial ilimitado
- **Pricing:**
  - Mensal: R$ 297,00 (recurring monthly)
  - Anual: R$ 2.851,20 (recurring yearly - 20% desconto)

**Copiar Price IDs:**
- `price_ZZZZZ` (monthly) → guardar
- `price_WWWWW` (yearly) → guardar

---

### ETAPA 5: Atualizar Price IDs no Banco

```bash
# Conectar ao banco
psql $DATABASE_URL

# Atualizar com os Price IDs reais do Stripe
UPDATE platform_settings SET value = 'price_XXXXX' WHERE key = 'stripe_price_id_pro_monthly';
UPDATE platform_settings SET value = 'price_YYYYY' WHERE key = 'stripe_price_id_pro_yearly';
UPDATE platform_settings SET value = 'price_ZZZZZ' WHERE key = 'stripe_price_id_enterprise_monthly';
UPDATE platform_settings SET value = 'price_WWWWW' WHERE key = 'stripe_price_id_enterprise_yearly';

-- Verificar
SELECT key, value FROM platform_settings WHERE key LIKE '%stripe_price%';

-- Sair do psql
\q
```

---

### ETAPA 6: Configurar Customer Portal no Stripe

1. Ir para: https://dashboard.stripe.com/settings/billing/portal
2. Ativar o Customer Portal
3. Configurar:
   - ✅ **Cancelar assinaturas** (permitir)
   - ✅ **Alterar plano** (permitir upgrade/downgrade)
   - ✅ **Atualizar método de pagamento** (permitir)
   - ✅ **Ver histórico de faturas** (permitir)

4. Salvar configurações

---

### ETAPA 7: Verificar Webhooks

1. Ir para: https://dashboard.stripe.com/webhooks
2. Verificar se o webhook está configurado para:
   ```
   https://SEU_DOMINIO/api/billing/webhook
   ```

3. Eventos necessários:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`

4. Copiar o **Signing Secret** e adicionar ao `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXX
   ```

---

### ETAPA 8: Registrar Jobs no server.js

Editar o arquivo `server.js` e adicionar APÓS a inicialização do servidor:

```javascript
// Inicializar jobs de subscription
const subscriptionJobs = require('./jobs/subscription-jobs');
subscriptionJobs.initJobs();

console.log('✅ Subscription jobs initialized');
```

**Localização recomendada:** Após `app.listen()` ou no final do arquivo.

---

### ETAPA 9: Executar SQL de Setup

```bash
# Executar script de configuração completo
psql $DATABASE_URL -f Implementações/SQL_SETUP_COMMANDS.sql
```

Este script irá:
- Verificar migrations
- Adicionar limites de plano
- Configurar features por plano

---

### ETAPA 10: Testar em Desenvolvimento

```bash
# Iniciar servidor
npm start

# OU
node server.js
```

**Testes mínimos:**

1. ✅ **Registro:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Teste Trial",
       "email": "teste@example.com",
       "password": "123456"
     }'
   ```

2. ✅ **Verificar Trial no Banco:**
   ```sql
   SELECT id, email, subscription_status, subscription_plan, trial_started_at, subscription_ends_at
   FROM users WHERE email = 'teste@example.com';
   ```

   Deve retornar:
   - subscription_status = 'trial'
   - subscription_plan = 'pro'
   - subscription_ends_at = NOW() + 14 dias

3. ✅ **Listar Planos:**
   ```bash
   curl http://localhost:3000/api/billing/plans
   ```

4. ✅ **Info de Subscription (autenticado):**
   ```bash
   curl http://localhost:3000/api/billing/subscription \
     -H "Cookie: token=SEU_TOKEN"
   ```

---

### ETAPA 11: Deploy em Produção

```bash
# 1. Parar servidor
pm2 stop app_name

# 2. Pull do código
git pull origin main

# 3. Instalar dependências
npm install

# 4. Executar migrations
psql $DATABASE_URL_PRODUCTION -f migrations/002_subscription_fields.sql
psql $DATABASE_URL_PRODUCTION -f migrations/003_subscription_history.sql
psql $DATABASE_URL_PRODUCTION -f migrations/004_invoices.sql
psql $DATABASE_URL_PRODUCTION -f migrations/005_platform_settings.sql

# 5. Atualizar Price IDs (ver ETAPA 5)

# 6. Reiniciar servidor
pm2 restart app_name

# 7. Verificar logs
pm2 logs app_name
```

**Buscar nos logs:**
```
✅ Subscription jobs initialized
```

---

## 🧪 Testes Pós-Deploy

### Teste 1: Novo Registro
1. Ir para `/register`
2. Criar nova conta
3. Verificar:
   - Login automático ✅
   - Banner de trial aparece ✅
   - Status no banco = 'trial' ✅
   - Email de boas-vindas recebido ✅

### Teste 2: Webhook do Stripe
1. No Stripe Dashboard → Webhooks
2. Clicar em "Send test webhook"
3. Escolher `checkout.session.completed`
4. Enviar
5. Verificar logs do servidor
6. Deve aparecer: "Processing Stripe webhook event"

### Teste 3: Checkout
1. Fazer login com usuário em trial
2. Ir para `/pricing`
3. Clicar em "Assinar Plano PRO"
4. Deve redirecionar para Stripe Checkout
5. Usar cartão de teste: `4242 4242 4242 4242`
6. Completar pagamento
7. Verificar:
   - Redirecionamento para `/app#settings?checkout=success` ✅
   - Status mudou para 'active' ✅
   - Email de ativação recebido ✅

### Teste 4: Limites de Plano
1. Fazer login com usuário FREE
2. Tentar criar 2º cliente
3. Deve retornar erro 403
4. Modal de upgrade deve aparecer ✅

### Teste 5: Jobs Agendados
```bash
# Forçar execução manual para testar
node -e "
const jobs = require('./jobs/subscription-jobs');
jobs.processExpiredTrials().then(() => console.log('OK'));
"
```

---

## 🔍 Monitoramento

### Queries Úteis para Monitorar

**Usuários em Trial:**
```sql
SELECT
    COUNT(*) as total_trial,
    COUNT(*) FILTER (WHERE subscription_ends_at > NOW() + INTERVAL '7 days') as safe,
    COUNT(*) FILTER (WHERE subscription_ends_at <= NOW() + INTERVAL '7 days' AND subscription_ends_at > NOW()) as expiring_soon,
    COUNT(*) FILTER (WHERE subscription_ends_at <= NOW()) as expired
FROM users
WHERE subscription_status = 'trial';
```

**Conversão Trial → Pago:**
```sql
SELECT
    COUNT(*) FILTER (WHERE subscription_status = 'active') * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE subscription_status IN ('trial', 'expired', 'active')), 0) as conversion_rate
FROM users;
```

**Eventos Recentes:**
```sql
SELECT
    event_type,
    COUNT(*) as count
FROM subscription_history
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

---

## ⚠️ Troubleshooting

### Problema: Jobs não estão executando
**Solução:**
```bash
# Verificar se está no server.js
grep "subscriptionJobs" server.js

# Verificar logs
pm2 logs | grep "Subscription jobs"
```

### Problema: Webhook retorna erro 401
**Solução:**
1. Verificar `STRIPE_WEBHOOK_SECRET` no `.env`
2. Recriar webhook no Stripe Dashboard
3. Atualizar secret

### Problema: Trial não inicia no registro
**Solução:**
```bash
# Verificar migration
psql $DATABASE_URL -c "SELECT trial_started_at FROM users LIMIT 1;"

# Verificar logs
grep "User registered with trial" logs/*.log
```

### Problema: Email não envia
**Solução:**
1. Verificar configuração de email no banco
2. Testar: `GET /api/admin/email/test`
3. Verificar logs: "Failed to send trial started email"

---

## 📊 Métricas para Acompanhar

1. **Taxa de Conversão Trial → Pago** (meta: > 10%)
2. **Churn Rate** (meta: < 5% mensal)
3. **MRR (Monthly Recurring Revenue)**
4. **Trials Iniciados por Dia**
5. **Emails de Lembrete Enviados**
6. **Webhooks com Falha** (meta: 0%)

---

## 🎉 Checklist Final

- [ ] Backup realizado
- [ ] node-cron instalado
- [ ] Migrations executadas
- [ ] Produtos criados no Stripe
- [ ] Price IDs atualizados
- [ ] Customer Portal configurado
- [ ] Webhooks verificados
- [ ] Jobs registrados no server.js
- [ ] SQL de setup executado
- [ ] Testes em desenvolvimento OK
- [ ] Deploy em produção
- [ ] Testes pós-deploy OK
- [ ] Monitoramento configurado

---

## 📞 Suporte

**Documentação Stripe:**
- https://stripe.com/docs

**Logs do Sistema:**
```bash
pm2 logs app_name --lines 100
```

**Status dos Jobs:**
```bash
pm2 describe app_name
```

---

**Deploy preparado por:** Claude AI
**Data:** 31/01/2026
**Versão:** 1.0.0

✅ **BACKEND 100% COMPLETO - PRONTO PARA DEPLOY!**
