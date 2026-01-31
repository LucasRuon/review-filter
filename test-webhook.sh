#!/bin/bash

# Script para testar webhook do Stripe
# Execute com: bash test-webhook.sh

echo "🧪 Teste do Webhook Stripe"
echo "=========================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Verificar se .env tem webhook secret
echo "🔍 1. Verificando configuração do webhook..."

if grep -q "STRIPE_WEBHOOK_SECRET=whsec_" .env; then
    echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET configurado no .env${NC}"
else
    echo -e "${RED}❌ STRIPE_WEBHOOK_SECRET não configurado ou inválido${NC}"
    echo ""
    echo "Configure primeiro executando:"
    echo "1. stripe listen --forward-to localhost:3000/api/billing/webhook"
    echo "2. Copie o whsec_xxx"
    echo "3. Adicione no .env"
    exit 1
fi
echo ""

# 2. Verificar se servidor está rodando
echo "🔍 2. Verificando se servidor está rodando..."

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor rodando em http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Servidor não está rodando${NC}"
    echo ""
    echo "Inicie o servidor primeiro:"
    echo "npm start"
    exit 1
fi
echo ""

# 3. Verificar se Stripe CLI está rodando
echo "🔍 3. Verificando Stripe CLI..."

if command -v stripe &> /dev/null; then
    echo -e "${GREEN}✅ Stripe CLI instalado${NC}"

    # Verificar se tem processo stripe listen rodando
    if pgrep -f "stripe listen" > /dev/null; then
        echo -e "${GREEN}✅ Stripe listen está rodando${NC}"
    else
        echo -e "${YELLOW}⚠️  Stripe listen não está rodando${NC}"
        echo ""
        echo "Execute em outro terminal:"
        echo "stripe listen --forward-to localhost:3000/api/billing/webhook"
        echo ""
        read -p "Pressione ENTER quando estiver rodando..."
    fi
else
    echo -e "${RED}❌ Stripe CLI não instalado${NC}"
    exit 1
fi
echo ""

# 4. Testar endpoint do webhook
echo "🔍 4. Testando endpoint do webhook..."

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}')

if [ "$RESPONSE" == "400" ]; then
    echo -e "${GREEN}✅ Endpoint responde (erro 400 é normal sem assinatura)${NC}"
else
    echo -e "${YELLOW}⚠️  Endpoint retornou código: $RESPONSE${NC}"
fi
echo ""

# 5. Disparar evento de teste
echo "🚀 5. Disparando evento de teste do Stripe..."
echo ""

echo "Executando: stripe trigger checkout.session.completed"
echo ""

stripe trigger checkout.session.completed

echo ""
echo "=========================="
echo -e "${GREEN}✅ Teste concluído!${NC}"
echo ""
echo "📋 Verifique nos logs do servidor se apareceu:"
echo "   ✅ Processing Stripe webhook event"
echo "   ✅ checkout.session.completed"
echo ""
echo "Se não aparecer, verifique:"
echo "1. STRIPE_WEBHOOK_SECRET está correto no .env"
echo "2. Servidor foi reiniciado após configurar"
echo "3. stripe listen está rodando"
echo ""
