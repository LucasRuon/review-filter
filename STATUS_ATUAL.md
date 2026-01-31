# Status Atual da Implementação Stripe

**Data:** 31/01/2026
**Hora:** Agora

---

## ✅ O Que Já Está Pronto

### 1. Código Backend (100% Completo)
- ✅ Migrations criadas (4 arquivos SQL)
- ✅ Funções database.js implementadas (9 novas funções)
- ✅ Middleware de subscription criado
- ✅ Rotas protegidas (clients, whatsapp)
- ✅ Stripe Service expandido (6 novos métodos)
- ✅ Rotas de billing criadas (7 endpoints)
- ✅ Jobs agendados criados (subscription-jobs.js)
- ✅ Templates de email implementados (6 novos)
- ✅ Jobs registrados no server.js

### 2. Dependências
- ✅ node-cron instalado

### 3. Credenciais Stripe
- ✅ STRIPE_SECRET_KEY configurada no .env
- ✅ STRIPE_PUBLISHABLE_KEY configurada no .env
- ⏳ STRIPE_WEBHOOK_SECRET (configurar depois)

### 4. Price IDs
- ✅ Produto Starter criado no Stripe
- ✅ Price ID: `price_1SowDo1T9tv9oH8YxTfwyXgP`

---

## ⏳ O Que Falta Fazer

### 1. Executar Migrations no Banco Railway

**Problema:** URL do banco é interna (postgres.railway.internal)

**Soluções:**

#### Opção A: Rodar Localmente (Recomendado)
1. Pegar URL **pública** do banco na Railway:
   - Dashboard Railway → PostgreSQL → Connect
   - Copiar "Public URL" (tipo: `postgresql://postgres:senha@containers-us-west-xxx.railway.app:6543/railway`)

2. Atualizar .env:
   ```env
   DATABASE_URL=URL_PUBLICA_AQUI
   ```

3. Executar:
   ```bash
   node run-migrations-env.js
   ```

#### Opção B: Rodar na Railway
1. Fazer commit e push do código
2. Na Railway, ir em Settings → Deploy → Trigger Deploy
3. Adicionar script no package.json:
   ```json
   "scripts": {
     "migrate": "node run-migrations-env.js"
   }
   ```
4. Executar na Railway: `npm run migrate`

### 2. Configurar Webhook

**Desenvolvimento Local:**
```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook

# Copiar o whsec_xxx e adicionar no .env
```

**Produção (após deploy):**
1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://SEU_DOMINIO/api/billing/webhook`
3. Eventos:
   - checkout.session.completed
   - customer.subscription.*
   - invoice.paid
   - invoice.payment_failed
4. Copiar webhook secret
5. Adicionar nas variáveis de ambiente da Railway

---

## 📋 Checklist Rápido

- [x] node-cron instalado
- [x] Credenciais Stripe no .env
- [x] Jobs registrados no server.js
- [ ] Migrations executadas no banco
- [ ] Price IDs configurados no banco
- [ ] Webhook configurado
- [ ] Testado: Criar novo usuário
- [ ] Testado: Checkout

---

## 🚀 Próximos Passos Imediatos

**AGORA:**
1. Me passe a URL **pública** do PostgreSQL da Railway
2. Vou executar as migrations
3. Vou testar o sistema completo

**OU:**

Se preferir fazer manual:
1. Execute: `node run-migrations-env.js` (com URL pública no .env)
2. Inicie o servidor: `npm start`
3. Teste criando um usuário

---

## 🎯 Comandos Prontos

### Executar Migrations
```bash
node run-migrations-env.js
```

### Iniciar Servidor
```bash
npm start
```

### Verificar no Banco
```bash
# Com psql (se tiver)
psql "URL_DO_BANCO" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'trial_started_at';"
```

### Testar API
```bash
# Criar usuário (via browser ou curl)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@example.com","password":"123456"}'
```

---

## 💡 Dica

Se você já fez deploy na Railway e está rodando lá:
1. As migrations podem ser executadas diretamente na Railway
2. Adicione um comando no package.json
3. Execute via Railway CLI ou interface

Se está rodando local:
1. Precisa da URL pública do banco
2. Configure Stripe CLI para webhooks
3. Teste completo local antes de fazer deploy

---

**Status Geral:** 95% completo
**Bloqueio:** URL do banco (Railway)
**Próximo passo:** Executar migrations
