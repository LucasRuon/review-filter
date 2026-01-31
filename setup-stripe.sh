#!/bin/bash

# Script de Setup do Stripe
# Execute com: bash setup-stripe.sh

echo "🚀 Setup do Stripe - Opina Já"
echo "================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Verificar se .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo "Criando .env a partir do .env.example..."
    cp .env.example .env 2>/dev/null || touch .env
fi

echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
echo ""

# 2. Verificar se as variáveis Stripe já existem
if grep -q "STRIPE_SECRET_KEY" .env; then
    echo -e "${YELLOW}⚠️  Variáveis Stripe já existem no .env${NC}"
    read -p "Deseja sobrescrever? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operação cancelada."
        exit 0
    fi
    # Remove linhas antigas do Stripe
    sed -i.bak '/STRIPE_/d' .env
fi

# 3. Solicitar credenciais
echo ""
echo "📋 Por favor, forneça as credenciais do Stripe:"
echo "(Você pode encontrá-las em https://dashboard.stripe.com/test/apikeys)"
echo ""

read -p "STRIPE_SECRET_KEY (sk_test_...): " SECRET_KEY
read -p "STRIPE_PUBLISHABLE_KEY (pk_test_...): " PUBLISHABLE_KEY
read -p "STRIPE_WEBHOOK_SECRET (whsec_...) [opcional agora]: " WEBHOOK_SECRET

# Validar se as chaves foram fornecidas
if [ -z "$SECRET_KEY" ] || [ -z "$PUBLISHABLE_KEY" ]; then
    echo -e "${RED}❌ Secret Key e Publishable Key são obrigatórias!${NC}"
    exit 1
fi

# 4. Adicionar ao .env
echo "" >> .env
echo "# Stripe Configuration" >> .env
echo "STRIPE_SECRET_KEY=$SECRET_KEY" >> .env
echo "STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY" >> .env
if [ ! -z "$WEBHOOK_SECRET" ]; then
    echo "STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> .env
fi

# Adicionar BASE_URL se não existir
if ! grep -q "BASE_URL" .env; then
    echo "" >> .env
    echo "# Base URL for redirects" >> .env
    echo "BASE_URL=http://localhost:3000" >> .env
fi

echo -e "${GREEN}✅ Credenciais adicionadas ao .env${NC}"
echo ""

# 5. Verificar se node-cron está instalado
echo "📦 Verificando dependências..."
if ! npm list node-cron >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  node-cron não instalado${NC}"
    read -p "Deseja instalar agora? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install node-cron
        echo -e "${GREEN}✅ node-cron instalado${NC}"
    fi
else
    echo -e "${GREEN}✅ node-cron já instalado${NC}"
fi
echo ""

# 6. Verificar se migrations foram executadas
echo "🗄️  Verificando banco de dados..."
if command_exists psql; then
    DB_URL=$(grep "DATABASE_URL" .env | cut -d '=' -f2)
    if [ ! -z "$DB_URL" ]; then
        # Verificar se coluna trial_started_at existe
        RESULT=$(psql "$DB_URL" -tAc "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'trial_started_at';" 2>/dev/null)

        if [ -z "$RESULT" ]; then
            echo -e "${YELLOW}⚠️  Migrations não executadas${NC}"
            read -p "Deseja executar as migrations agora? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "Executando migrations..."
                psql "$DB_URL" -f migrations/002_subscription_fields.sql
                psql "$DB_URL" -f migrations/003_subscription_history.sql
                psql "$DB_URL" -f migrations/004_invoices.sql
                psql "$DB_URL" -f migrations/005_platform_settings.sql
                echo -e "${GREEN}✅ Migrations executadas${NC}"
            fi
        else
            echo -e "${GREEN}✅ Migrations já executadas${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  psql não encontrado. Execute migrations manualmente.${NC}"
fi
echo ""

# 7. Solicitar Price IDs
echo "💰 Configuração de Price IDs"
echo "Você pode fazer isso depois editando diretamente o banco de dados."
echo ""
read -p "Deseja configurar Price IDs agora? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Cole os Price IDs do Stripe Dashboard:"
    read -p "PRO Mensal (price_...): " PRO_MONTHLY
    read -p "PRO Anual (price_...): " PRO_YEARLY
    read -p "Enterprise Mensal (price_...): " ENT_MONTHLY
    read -p "Enterprise Anual (price_...): " ENT_YEARLY

    if [ ! -z "$PRO_MONTHLY" ]; then
        DB_URL=$(grep "DATABASE_URL" .env | cut -d '=' -f2)
        if command_exists psql && [ ! -z "$DB_URL" ]; then
            psql "$DB_URL" -c "UPDATE platform_settings SET value = '$PRO_MONTHLY' WHERE key = 'stripe_price_id_pro_monthly';"
            [ ! -z "$PRO_YEARLY" ] && psql "$DB_URL" -c "UPDATE platform_settings SET value = '$PRO_YEARLY' WHERE key = 'stripe_price_id_pro_yearly';"
            [ ! -z "$ENT_MONTHLY" ] && psql "$DB_URL" -c "UPDATE platform_settings SET value = '$ENT_MONTHLY' WHERE key = 'stripe_price_id_enterprise_monthly';"
            [ ! -z "$ENT_YEARLY" ] && psql "$DB_URL" -c "UPDATE platform_settings SET value = '$ENT_YEARLY' WHERE key = 'stripe_price_id_enterprise_yearly';"
            echo -e "${GREEN}✅ Price IDs atualizados no banco${NC}"
        fi
    fi
fi
echo ""

# 8. Resumo final
echo "================================"
echo -e "${GREEN}✅ Setup concluído!${NC}"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o webhook no Stripe Dashboard:"
echo "   URL: http://localhost:3000/api/billing/webhook"
echo "   Eventos: checkout.session.completed, customer.subscription.*"
echo ""
echo "2. Registre os jobs no server.js (se ainda não fez):"
echo "   const subscriptionJobs = require('./jobs/subscription-jobs');"
echo "   subscriptionJobs.initJobs();"
echo ""
echo "3. Inicie o servidor:"
echo "   npm start"
echo ""
echo "4. Teste criando um novo usuário!"
echo ""
echo "📚 Documentação completa em: STRIPE_CONFIG_GUIDE.md"
echo "================================"
