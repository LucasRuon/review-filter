# ⚡ Guia Rápido - Webhook em 5 Minutos

## 📋 Checklist

- [ ] Stripe CLI instalado
- [ ] Login feito no Stripe
- [ ] Stripe listen rodando
- [ ] Webhook secret no .env
- [ ] Servidor reiniciado
- [ ] Testado com sucesso

---

## 🚀 Comandos (Copie e Cole)

### 1. Executar o Setup Automático

```bash
cd /Users/lucasruon/Downloads/review-filter
bash setup-webhook.sh
```

Isso vai:
- Instalar Stripe CLI (se necessário)
- Fazer login no Stripe
- Mostrar próximos passos

---

### 2. Iniciar o Forward de Webhooks

**IMPORTANTE:** Abra um **novo terminal** e execute:

```bash
cd /Users/lucasruon/Downloads/review-filter
stripe listen --forward-to localhost:3000/api/billing/webhook
```

**Deixe este terminal rodando!**

Você vai ver algo como:
```
> Ready! Your webhook signing secret is whsec_a1b2c3d4e5...
```

**Copie o código `whsec_...`**

---

### 3. Adicionar o Secret no .env

Abra o arquivo `.env` e substitua esta linha:

```env
STRIPE_WEBHOOK_SECRET=CONFIGURAR_DEPOIS_DE_CRIAR_WEBHOOK
```

Por:

```env
STRIPE_WEBHOOK_SECRET=whsec_COLE_AQUI_O_CODIGO
```

Salve o arquivo.

---

### 4. Reiniciar o Servidor

No terminal onde o servidor está rodando:

```bash
# Pare com Ctrl+C
# Inicie novamente:
npm start
```

Você deve ver:
```
✅ Subscription jobs initialized
Opina Já! Server started successfully
```

---

### 5. Testar

Execute o script de teste:

```bash
bash test-webhook.sh
```

Ou manualmente:

```bash
stripe trigger checkout.session.completed
```

---

## ✅ Verificar se Funcionou

Nos logs do servidor, você deve ver:

```
✅ Processing Stripe webhook event
type: checkout.session.completed
```

---

## 🎯 Resumo Visual

```
┌─────────────────┐
│  Stripe CLI     │
│  (stripe listen)│
└────────┬────────┘
         │ webhooks
         ↓
┌─────────────────┐
│  Seu Servidor   │
│  localhost:3000 │
└────────┬────────┘
         │ processa
         ↓
┌─────────────────┐
│  Banco de Dados │
│  Ativa assinatura│
└─────────────────┘
```

---

## ⚠️ Troubleshooting

### "Webhook signature verification failed"

**Solução:**
1. Certifique-se que copiou o `whsec_` completo
2. Sem espaços extras no .env
3. Reiniciou o servidor

### "stripe: command not found"

**Solução:**
```bash
brew install stripe/stripe-cli/stripe
```

### Servidor não recebe webhooks

**Solução:**
1. Verificar se `stripe listen` está rodando
2. URL no listen deve ser: `localhost:3000/api/billing/webhook`
3. Verificar logs do servidor

---

## 📊 Próximo Passo

Após webhook configurado, teste o fluxo completo:

1. Criar usuário
2. Fazer checkout
3. Pagar com cartão teste: `4242 4242 4242 4242`
4. Verificar se assinatura ativou automaticamente

---

**Dúvidas?** Veja o guia completo em `WEBHOOK_SETUP.md`
