# /research - Pesquisa de Codebase OpinaJá

> Comando para pesquisar a base de código antes de implementar qualquer feature ou correção.
> **Uso:** `/research [pergunta ou área de interesse]`

---

## Instruções para o Claude Code

Você é responsável por conduzir uma pesquisa abrangente na base de código para responder às perguntas do usuário.

### REGRAS FUNDAMENTAIS

- **NÃO** sugira melhorias ou mudanças, a menos que o usuário peça explicitamente
- **NÃO** faça análise de causa raiz, a menos que o usuário peça explicitamente
- **NÃO** proponha melhorias futuras, a menos que o usuário peça explicitamente
- **NÃO** critique a implementação ou identifique problemas
- **NÃO** recomende refatoração, otimização ou mudanças arquiteturais
- **APENAS** descreva o que existe, onde existe, como funciona e como os componentes interagem
- Você está criando um **mapa técnico/documentação** do sistema existente

---

## Fluxo de Execução

### Passo 1: Início

Diga exatamente:

```
Estou pronto para pesquisar a base de código do OpinaJá.
Por favor, forneça sua pergunta de pesquisa ou área de interesse,
e vou analisá-la explorando componentes relevantes e conexões.
```

Aguarde a pergunta do usuário.

---

### Passo 2: Análise Inicial

Depois de receber a pergunta:

1. **Pense profundamente** sobre os padrões subjacentes, conexões e implicações arquiteturais que o usuário pode estar buscando
2. **Identifique** componentes específicos, padrões ou conceitos para investigar
3. **Crie um plano de pesquisa** listando todas as subtarefas
4. **Considere** quais diretórios, arquivos ou padrões arquiteturais são relevantes

---

### Passo 3: Pesquisa na Base de Código

#### 3.1 Localize Arquivos Relevantes

Pesquise nas seguintes áreas do OpinaJá:

**Backend (Express.js):**
- `server.js` - Configuração principal, middleware, rotas
- `database.js` - Todas as queries SQL e funções de banco
- `routes/` - Endpoints da API organizados por domínio
  - `routes/auth.js` - Autenticação, registro, perfil
  - `routes/clients.js` - CRUD clientes, tópicos, filiais, reclamações
  - `routes/review.js` - Página pública de reclamações
  - `routes/billing.js` - Stripe, assinaturas, planos
  - `routes/whatsapp.js` - Gerenciamento de instâncias WhatsApp
  - `routes/admin.js` - Painel administrativo

**Middleware:**
- `middleware/auth.js` - Validação JWT, cache de autenticação
- `middleware/subscription.js` - Verificação de planos e limites

**Services:**
- `services/stripe-service.js` - Integração com Stripe API
- `services/whatsapp-service.js` - Integração com UAZAPI
- `services/email-service.js` - Nodemailer e Resend API
- `services/cache-service.js` - Cache em memória com TTL

**Jobs Agendados:**
- `jobs/subscription-jobs.js` - Cron jobs (node-cron)

**Banco de Dados:**
- `migrations/` - Arquivos SQL de migração
- `database.js` - Schema implícito nas queries

**Frontend (Vanilla JS):**
- `views/` - Templates HTML
- `views/spa/` - Fragmentos para SPA
- `public/js/app.js` - JavaScript do frontend
- `public/css/style.css` - Estilos

**Configurações:**
- `package.json` - Dependências e scripts
- `.env` / `.env.example` - Variáveis de ambiente
- `Procfile` - Deploy Railway

#### 3.2 Analise Padrões Existentes

Para cada área relevante, identifique:
- Padrões de implementação usados
- Convenções de nomenclatura
- Estrutura de rotas Express
- Fluxo de dados
- Integrações externas (Stripe, UAZAPI, Resend, etc.)

#### 3.3 Busca Externa (se necessário)

Se a implementação requer tecnologias externas:
- Busque documentação oficial
- Encontre padrões de implementação recomendados
- Identifique exemplos relevantes

---

### Passo 4: Coleta de Metadados

Colete as seguintes informações:
- Data e hora atual
- Branch atual do Git (se aplicável)
- Commit atual (se aplicável)
- Nome do repositório

---

### Passo 5: Geração do Documento de Pesquisa

Crie o documento em `docs/research/` com a seguinte estrutura:

**Nome do arquivo:** `YYYY-MM-DD-[descrição-curta].md`

**Exemplo:** `2025-01-31-sistema-autenticacao.md`

```markdown
---
date: [Data e hora atual ISO]
researcher: Claude
git_commit: [Hash do commit atual]
branch: [Branch atual]
repository: review-filter
topic: "[Pergunta/Tópico do Usuário]"
tags: [research, codebase, componentes-relevantes]
status: complete
---

# Pesquisa: [Pergunta/Tópico do Usuário]

**Data**: [Data e hora]
**Branch**: [Branch atual]
**Commit**: [Hash do commit]

## Pergunta de Pesquisa

[Pergunta original do usuário]

## Resumo

[Documentação de alto nível do que foi encontrado, respondendo a pergunta do usuário descrevendo o que existe]

## Descobertas Detalhadas

### [Componente/Área 1]

- Descrição do que existe (`arquivo.js:linha`)
- Como se conecta com outros componentes
- Detalhes da implementação atual

### [Componente/Área 2]

- Descrição do que existe (`arquivo.js:linha`)
- Como se conecta com outros componentes
- Detalhes da implementação atual

## Referências de Código

- `routes/auth.js:123` - Descrição do que está lá
- `database.js:45-67` - Descrição do bloco de código

## Padrões Arquiteturais

[Padrões, convenções e decisões de design descobertos na base de código]

## Tecnologias e Integrações

| Tecnologia | Uso no Projeto | Arquivos Relacionados |
|------------|----------------|----------------------|
| PostgreSQL | Banco de dados | `database.js` |
| JWT | Autenticação | `middleware/auth.js`, `routes/auth.js` |
| Stripe | Pagamentos | `services/stripe-service.js`, `routes/billing.js` |
| UAZAPI | WhatsApp | `services/whatsapp-service.js`, `routes/whatsapp.js` |
| Nodemailer/Resend | Emails | `services/email-service.js` |

## Code Snippets Relevantes

[Trechos de código que exemplificam os padrões usados]

## Documentação Externa Consultada

- [Links para documentações relevantes]

## Questões em Aberto

[Áreas que precisam de investigação adicional, se houver]
```

---

### Passo 6: Finalização

Depois de gerar o documento:

1. **Informe** o caminho do documento criado
2. **Apresente** um resumo das descobertas principais
3. **Destaque** padrões, conexões e decisões arquiteturais encontradas
4. **Responda** as perguntas específicas do usuário com evidências concretas

---

## Exemplo de Uso

**Usuário:** `/research Como funciona o sistema de reclamações e notificações?`

**Claude:**
1. Pesquisa arquivos em `routes/review.js`, `routes/clients.js`
2. Analisa funções em `database.js` relacionadas a complaints
3. Identifica a integração com WhatsApp e Webhook para notificações
4. Documenta o fluxo: Reclamação → Salva no DB → Notifica via WhatsApp/Webhook
5. Gera documento em `docs/research/2025-01-31-sistema-reclamacoes.md`
6. Apresenta resumo ao usuário

---

## Stack Técnica do OpinaJá (Referência)

| Tecnologia | Uso |
|------------|-----|
| Node.js | Runtime |
| Express.js 4.18 | Framework backend |
| PostgreSQL | Banco de dados |
| Raw SQL | Queries em database.js |
| JWT | Autenticação |
| bcryptjs | Hash de senhas |
| Stripe | Pagamentos |
| UAZAPI | WhatsApp |
| Nodemailer/Resend | Emails |
| node-cron | Jobs agendados |
| Vanilla HTML/CSS/JS | Frontend |
| Railway.app | Deploy |

---

## Tabelas do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema + dados de subscription |
| `clients` | Clientes/estabelecimentos do usuário |
| `client_branches` | Filiais dos clientes |
| `complaint_topics` | Tópicos de reclamação por cliente |
| `complaints` | Reclamações recebidas |
| `integrations` | Configurações de webhook (legacy WhatsApp) |
| `whatsapp_instances` | Instâncias WhatsApp (nova arquitetura) |
| `platform_settings` | Configurações globais (key-value) |
| `subscription_history` | Histórico de mudanças de subscription |
| `invoices` | Faturas sincronizadas do Stripe |
| `admin_users` | Usuários do painel admin |
| `admin_logs` | Logs de auditoria admin |

---

## Notas Importantes

1. **Não modifique código** durante a pesquisa
2. **Seja objetivo** - descreva o que existe, não o que deveria existir
3. **Documente tudo** - o documento gerado será usado nas próximas etapas
4. **Preserve contexto** - inclua informações suficientes para que alguém entenda o sistema sem rodar o código
