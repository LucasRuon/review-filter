# Comandos de Setup - Opina Já Stripe

**IMPORTANTE:** Você está usando chaves de **PRODUÇÃO** (live)!

---

## ✅ Passo 1: Credenciais Configuradas no .env

As seguintes variáveis foram adicionadas ao `.env`:

```env
STRIPE_SECRET_KEY=sk_live_51SmMxJ1T9tv9oH8Y... ✅
STRIPE_PUBLISHABLE_KEY=pk_live_51SmMxJ1T9tv9oH8Y... ✅
STRIPE_WEBHOOK_SECRET=CONFIGURAR_DEPOIS ⏳
BASE_URL=http://localhost:3000 ✅
```

---

## 📋 Passo 2: Executar Migrations no Banco

**IMPORTANTE:** Faça backup antes!

```bash
# 1. Fazer backup
pg_dump postgresql://localhost:5432/review_filter > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Executar migrations
cd /Users/lucasruon/Downloads/review-filter

psql postgresql://localhost:5432/review_filter -f migrations/002_subscription_fields.sql
psql postgresql://localhost:5432/review_filter -f migrations/003_subscription_history.sql
psql postgresql://localhost:5432/review_filter -f migrations/004_invoices.sql
psql postgresql://localhost:5432/review_filter -f migrations/005_platform_settings.sql
```

**Verificar se deu certo:**
```bash
psql postgresql://localhost:5432/review_filter -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('trial_started_at', 'billing_email');"
```

Deve retornar 2 linhas.

---

## 💰 Passo 3: Configurar Price IDs

Você tem 2 produtos criados no Stripe:

1. **Opinajá - Starter** (único): `price_1SowDo1T9tv9oH8YxTfwyXgP`
2. **Instância adicional**: `price_1Svdk71T9tv9oH8YxfWd01Xt`

### ⚠️ ATENÇÃO: Estrutura Esperada

O sistema espera **4 price IDs** para funcionar corretamente:
- PRO Mensal
- PRO Anual (com desconto)
- Enterprise Mensal
- Enterprise Anual (com desconto)

**Você tem apenas 1 produto "Starter". Você precisa decidir:**

### Opção A: Usar "Starter" como Plano PRO (Recomendado)

Se o plano "Starter" for o seu plano principal:

```bash
# Conectar ao banco
psql postgresql://localhost:5432/review_filter
```

```sql
-- Configurar o Starter como PRO Mensal
UPDATE platform_settings
SET value = 'price_1SowDo1T9tv9oH8YxTfwyXgP'
WHERE key = 'stripe_price_id_pro_monthly';

-- Por enquanto, deixar os outros vazios (você pode criar depois)
UPDATE platform_settings SET value = '' WHERE key = 'stripe_price_id_pro_yearly';
UPDATE platform_settings SET value = '' WHERE key = 'stripe_price_id_enterprise_monthly';
UPDATE platform_settings SET value = '' WHERE key = 'stripe_price_id_enterprise_yearly';

-- Verificar
SELECT key, value FROM platform_settings WHERE key LIKE '%stripe_price%';

-- Sair
\q
```

### Opção B: Criar Todos os Preços no Stripe (Melhor para o Futuro)

Se quiser ter todos os planos (PRO e Enterprise):

1. **Acesse:** https://dashboard.stripe.com/products
2. **No produto "Opinajá - Starter"**, crie mais preços:
   - Anual (com desconto de 20%)
3. **Crie novo produto "Opinajá - Enterprise"** com:
   - Preço Mensal
   - Preço Anual (com desconto de 20%)
4. Copie os 4 Price IDs
5. Execute o SQL abaixo:

```sql
UPDATE platform_settings SET value = 'price_XXX_pro_monthly' WHERE key = 'stripe_price_id_pro_monthly';
UPDATE platform_settings SET value = 'price_XXX_pro_yearly' WHERE key = 'stripe_price_id_pro_yearly';
UPDATE platform_settings SET value = 'price_XXX_ent_monthly' WHERE key = 'stripe_price_id_enterprise_monthly';
UPDATE platform_settings SET value = 'price_XXX_ent_yearly' WHERE key = 'stripe_price_id_enterprise_yearly';
```

---

## 🔗 Passo 4: Configurar Webhook no Stripe

**CRÍTICO PARA PAGAMENTOS FUNCIONAREM!**

### Para Desenvolvimento Local:

1. **Instalar Stripe CLI:**
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login:**
   ```bash
   stripe login
   ```

3. **Forward webhooks:**
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```

   Isso vai mostrar algo como:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxx
   ```

4. **Copiar o secret e adicionar no .env:**
   ```bash
   # Editar .env e substituir:
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### Para Produção (quando fizer deploy):

1. **Acesse:** https://dashboard.stripe.com/webhooks
2. **Clique em:** "+ Add endpoint"
3. **URL:** `https://SEU_DOMINIO.com/api/billing/webhook`
4. **Selecionar eventos:**
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
5. **Salvar** e copiar o "Signing secret"
6. Adicionar no `.env` de produção

---

## 📦 Passo 5: Instalar Dependências

```bash
cd /Users/lucasruon/Downloads/review-filter
npm install node-cron
```

---

## ⚙️ Passo 6: Registrar Jobs no server.js

Edite o arquivo `server.js` e adicione **APÓS** a linha `app.listen()`:

```javascript
// Inicializar jobs de subscription
const subscriptionJobs = require('./jobs/subscription-jobs');
subscriptionJobs.initJobs();

console.log('✅ Subscription jobs initialized');
```

**Localização recomendada:** No final do arquivo, após o `app.listen(...)`.

---

## 🚀 Passo 7: Iniciar o Servidor

```bash
npm start
```

**Verificar nos logs:**
```
✅ Subscription jobs initialized
```

---

## 🧪 Passo 8: Testar

### Teste 1: Criar Novo Usuário

1. Acesse: http://localhost:3000/register
2. Crie uma conta teste
3. Verifique no banco:

```sql
psql postgresql://localhost:5432/review_filter

SELECT
    id,
    email,
    subscription_status,
    subscription_plan,
    trial_started_at,
    subscription_ends_at
FROM users
ORDER BY created_at DESC
LIMIT 1;
```

**Deve mostrar:**
- `subscription_status` = `trial`
- `subscription_plan` = `pro`
- `subscription_ends_at` = data atual + 14 dias

### Teste 2: API de Subscription

```bash
# Primeiro faça login e copie o token do cookie
# Depois:

curl http://localhost:3000/api/billing/subscription \
  -H "Cookie: token=SEU_TOKEN_AQUI"
```

**Deve retornar:**
```json
{
  "success": true,
  "subscription": {
    "status": "trial",
    "plan": "pro",
    "daysRemaining": 14,
    "isActive": true
  },
  "limits": {
    "maxClients": 10,
    "maxBranches": 10
  }
}
```

### Teste 3: Listar Planos

```bash
curl http://localhost:3000/api/billing/plans
```

### Teste 4: Webhook (com Stripe CLI)

```bash
# Em outro terminal, com stripe listen rodando:
stripe trigger checkout.session.completed
```

Deve aparecer nos logs do servidor:
```
✅ Processing Stripe webhook event
```

---

## ⚠️ AVISOS IMPORTANTES

### 🔴 Você está usando chaves de PRODUÇÃO!

- **Pagamentos serão REAIS**
- **Clientes serão COBRADOS de verdade**
- Para testes, use chaves de teste (começam com `sk_test_` e `pk_test_`)

### 🔄 Como Mudar para Modo Teste:

1. **Stripe Dashboard** → Mudar para "Test mode" (toggle no topo)
2. Copiar novas chaves de teste
3. Substituir no `.env`
4. Recriar webhook para modo teste

### 🛡️ Segurança:

- **NUNCA** faça commit do `.env`
- Verifique se `.env` está no `.gitignore`
- Use variáveis de ambiente no servidor de produção

---

## 📊 Estrutura Atual dos Seus Produtos

Baseado no que você informou:

| Produto | Price ID | Valor |
|---------|----------|-------|
| Opinajá - Starter | `price_1SowDo1T9tv9oH8YxTfwyXgP` | ? |
| Instância Adicional | `price_1Svdk71T9tv9oH8YxfWd01Xt` | R$ 39,90 |

**Recomendação:**
- Use "Starter" como plano PRO mensal
- Crie preço anual com desconto
- Considere criar plano Enterprise no futuro

---

## 🎯 Próximos Passos Após Setup

1. ✅ Testar fluxo completo de registro
2. ✅ Testar checkout (use cartão de teste se estiver em modo teste)
3. ✅ Verificar emails sendo enviados
4. ✅ Testar expiração de trial (pode forçar mudando a data no banco)
5. ⏳ Implementar frontend (Fase 10)

---

## 🆘 Problemas Comuns

### Erro: "Stripe not configured"
- Verifique se `.env` tem as chaves
- Reinicie o servidor

### Webhook retorna 401
- Verifique `STRIPE_WEBHOOK_SECRET` no `.env`
- Use Stripe CLI para desenvolvimento

### Jobs não executam
- Verifique se `subscriptionJobs.initJobs()` está no `server.js`
- Verifique se `node-cron` está instalado

---

**Qualquer dúvida, me avise!** 🚀
