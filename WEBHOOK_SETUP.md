# 🔗 Configuração do Webhook Stripe - Passo a Passo

**Escolha a opção que se aplica ao seu caso:**

---

## Opção A: Desenvolvimento Local (Testando na sua máquina) 🏠

### Passo 1: Instalar Stripe CLI

```bash
# No terminal:
brew install stripe/stripe-cli/stripe
```

**Alternativa (se não tiver Homebrew):**
- Download: https://github.com/stripe/stripe-cli/releases/latest
- Baixe o arquivo para macOS
- Extraia e mova para /usr/local/bin

---

### Passo 2: Fazer Login no Stripe CLI

```bash
stripe login
```

Isso vai:
1. Abrir seu navegador
2. Pedir para confirmar o login
3. Conectar o CLI à sua conta Stripe

---

### Passo 3: Iniciar o Forward de Webhooks

**IMPORTANTE:** Deixe este comando rodando em um terminal separado!

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Você vai ver algo assim:
```
> Ready! You are using Stripe API Version [2024-xx-xx].
> Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxx
```

---

### Passo 4: Copiar o Webhook Secret

Copie o código que começa com `whsec_` que apareceu no passo anterior.

---

### Passo 5: Adicionar no .env

Abra o arquivo `.env` e substitua:

```env
STRIPE_WEBHOOK_SECRET=whsec_COLE_AQUI_O_CODIGO_QUE_COPIOU
```

---

### Passo 6: Reiniciar o Servidor

```bash
# Pare o servidor se estiver rodando (Ctrl+C)
# Inicie novamente:
npm start
```

---

### ✅ Pronto! Agora Teste

Com o Stripe CLI rodando e o servidor iniciado:

```bash
# Em outro terminal, simule um evento de checkout:
stripe trigger checkout.session.completed
```

Você deve ver nos logs do servidor:
```
✅ Processing Stripe webhook event - type: checkout.session.completed
```

---

## Opção B: Produção na Railway (Deploy Público) 🚀

### Passo 1: Fazer Deploy do Código

Seu código já está pronto! Certifique-se de que:
- `.env` está no `.gitignore` (não fazer commit dele!)
- Código está commitado no Git
- Deploy feito na Railway

---

### Passo 2: Pegar a URL da Railway

Sua aplicação na Railway terá uma URL tipo:
```
https://SEU_APP.railway.app
```

Guarde essa URL.

---

### Passo 3: Criar Webhook no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **"+ Add endpoint"**
3. **Endpoint URL:** `https://SEU_APP.railway.app/api/billing/webhook`
4. **Description:** "Opina Já - Production Webhook"
5. **Events to send:** Clique em "Select events"

---

### Passo 4: Selecionar Eventos

Marque estes eventos:

**Checkout:**
- ✅ `checkout.session.completed`

**Assinaturas:**
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

**Faturas:**
- ✅ `invoice.paid`
- ✅ `invoice.payment_failed`

Clique em **"Add events"**

---

### Passo 5: Salvar e Copiar o Secret

1. Clique em **"Add endpoint"**
2. Na página do webhook criado, encontre **"Signing secret"**
3. Clique em **"Reveal"**
4. Copie o código que começa com `whsec_`

---

### Passo 6: Adicionar na Railway

1. No projeto Railway, vá em **Variables**
2. Adicione uma nova variável:
   - **Nome:** `STRIPE_WEBHOOK_SECRET`
   - **Valor:** `whsec_CODIGO_QUE_COPIOU`
3. Clique em **"Add"**

A Railway vai reiniciar automaticamente.

---

### ✅ Pronto! Agora Teste

No Stripe Dashboard:
1. Vá no webhook que criou
2. Clique em **"Send test webhook"**
3. Escolha `checkout.session.completed`
4. Clique em **"Send test webhook"**

Verifique nos logs da Railway se o evento foi processado.

---

## 🧪 Como Testar o Webhook

### Teste 1: Verificar se o Endpoint Responde

```bash
curl -X POST https://SEU_DOMINIO/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Deve retornar erro 400 (normal, porque falta a assinatura).

---

### Teste 2: Simular Checkout Completo (Local)

Com Stripe CLI rodando:

```bash
stripe trigger checkout.session.completed
```

---

### Teste 3: Fluxo Real de Pagamento

1. Criar um usuário
2. Fazer login
3. Chamar API de checkout:
```bash
curl -X POST http://localhost:3000/api/billing/subscribe \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN" \
  -d '{"plan":"pro","billing_cycle":"monthly"}'
```
4. Abrir a URL retornada
5. Pagar (use cartão de teste: 4242 4242 4242 4242)
6. Verificar se a assinatura foi ativada automaticamente

---

## 🔍 Verificar se Funcionou

### No Banco de Dados

```sql
-- Ver o último usuário
SELECT id, email, subscription_status, subscription_plan
FROM users
ORDER BY id DESC
LIMIT 1;

-- Ver eventos de subscription
SELECT * FROM subscription_history
ORDER BY created_at DESC
LIMIT 5;
```

Depois do pagamento, `subscription_status` deve mudar de `trial` para `active`.

---

## ⚠️ Troubleshooting

### Erro: "Webhook signature verification failed"

**Causa:** STRIPE_WEBHOOK_SECRET errado ou não configurado

**Solução:**
1. Verificar se o secret no .env está correto
2. Reiniciar o servidor
3. Verificar se não tem espaços extras

---

### Erro: "No signatures found"

**Causa:** Stripe CLI não está rodando (modo local)

**Solução:**
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

---

### Webhook recebe mas não processa

**Verificar nos logs:**
```
✅ Processing Stripe webhook event
```

Se não aparecer, verificar:
1. STRIPE_WEBHOOK_SECRET está configurado?
2. Servidor foi reiniciado depois de configurar?
3. Jobs foram registrados no server.js?

---

## 📊 Logs Esperados

Quando um pagamento for concluído, você deve ver:

```
✅ Processing Stripe webhook event - type: checkout.session.completed
✅ Platform subscription checkout completed - userId: 123
✅ Subscription activated - plan: pro
```

---

## 🎯 Próximo Passo Após Configurar

Depois que o webhook estiver funcionando:

1. **Testar fluxo completo:**
   - Criar usuário
   - Esperar trial expirar (ou forçar no banco)
   - Fazer checkout
   - Pagar
   - Verificar se ativa automaticamente

2. **Implementar interface:**
   - Banner de trial
   - Página de pricing
   - Modal de bloqueio

---

**Qual opção você vai usar?**
- **Opção A** para testar localmente agora
- **Opção B** para configurar em produção na Railway
