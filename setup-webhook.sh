#!/bin/bash

# Script para configurar Webhook do Stripe
# Execute com: bash setup-webhook.sh

echo "🔗 Configuração do Webhook Stripe"
echo "=================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verificar se Stripe CLI está instalado
echo "🔍 Verificando Stripe CLI..."
if ! command -v stripe &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stripe CLI não encontrado${NC}"
    echo ""
    read -p "Deseja instalar agora? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Instalando Stripe CLI..."
        brew install stripe/stripe-cli/stripe
        echo -e "${GREEN}✅ Stripe CLI instalado!${NC}"
    else
        echo -e "${RED}❌ Stripe CLI é necessário. Abortando.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Stripe CLI já instalado${NC}"
fi
echo ""

# 2. Fazer login
echo "🔐 Fazendo login no Stripe..."
echo "Isso vai abrir seu navegador para autenticação."
read -p "Pressione ENTER para continuar..."

stripe login

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro no login. Tente novamente.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Login realizado com sucesso!${NC}"
echo ""

# 3. Instruções para o próximo passo
echo "=================================="
echo -e "${GREEN}✅ Stripe CLI configurado!${NC}"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1️⃣  Execute este comando em um terminal SEPARADO:"
echo -e "   ${YELLOW}stripe listen --forward-to localhost:3000/api/billing/webhook${NC}"
echo ""
echo "2️⃣  Copie o código whsec_xxx que aparecer"
echo ""
echo "3️⃣  Adicione no arquivo .env:"
echo -e "   ${YELLOW}STRIPE_WEBHOOK_SECRET=whsec_SEU_CODIGO${NC}"
echo ""
echo "4️⃣  Reinicie o servidor:"
echo -e "   ${YELLOW}npm start${NC}"
echo ""
echo "5️⃣  Teste o webhook:"
echo -e "   ${YELLOW}stripe trigger checkout.session.completed${NC}"
echo ""
echo "=================================="
echo ""
echo "💡 Dica: Mantenha o 'stripe listen' rodando enquanto desenvolve!"
echo ""
