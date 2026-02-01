# Workflow SDD (Spec-Driven Development) - OpinaJá

Sistema de prompts para desenvolvimento estruturado com Claude Code, baseado no workflow da [HumanLayer](https://github.com/humanlayer/humanlayer) e adaptado para o projeto OpinaJá.

## O Problema

Quando usamos IA para coding sem método:
- **Over-engineering** - código mais complexo que o necessário
- **Reinventar a roda** - criar do zero o que já existe
- **Context window cheia** - qualidade degrada conforme a conversa cresce
- **Código repetido** - a IA não lembra que já criou aquele componente
- **Tudo no mesmo lugar** - responsabilidades misturadas

## A Solução: Pesquisa → Spec → Implementação

O workflow SDD divide o trabalho em 3 etapas com `/clear` entre elas:

```
┌─────────────┐    /clear    ┌─────────────┐    /clear    ┌─────────────┐
│  PESQUISA   │ ──────────▶  │    SPEC     │ ──────────▶  │ IMPLEMENTAR │
│             │              │             │              │             │
│ • Entender  │              │ • Planejar  │              │ • Executar  │
│ • Mapear    │              │ • Detalhar  │              │ • Verificar │
│ • Documentar│              │ • Validar   │              │ • Entregar  │
└─────────────┘              └─────────────┘              └─────────────┘
      │                            │                            │
      ▼                            ▼                            ▼
  Research.md                  Spec.md                    Código Pronto
```

## Estrutura de Arquivos

```
review-filter/
├── .claude/
│   └── commands/
│       ├── research_codebase.md   # /research
│       ├── create_plan.md         # /spec
│       └── implement_plan.md      # /implement
├── docs/
│   ├── research/                  # Documentos de pesquisa
│   │   └── 2025-01-31-auth.md
│   └── specs/                     # Planos de implementação
│       └── 2025-01-31-auth-spec.md
└── ...
```

## Instalação

### 1. Criar estrutura de diretórios

```bash
# Na raiz do seu projeto OpinaJá
mkdir -p .claude/commands
mkdir -p docs/research
mkdir -p docs/specs
```

### 2. Copiar os prompts

Copie os 3 arquivos `.md` para `.claude/commands/`:

```bash
# Se você baixou os arquivos
cp research_codebase.md .claude/commands/
cp create_plan.md .claude/commands/
cp implement_plan.md .claude/commands/
```

### 3. Verificar instalação

No Claude Code, digite:
```
/research
```

Se aparecer a mensagem de início, está funcionando!

---

## Como Usar

### Exemplo Prático: Implementar Confirmação de Email

#### Etapa 1: Pesquisa

```bash
# No Claude Code
/research Como funciona o sistema de autenticação e cadastro de usuários?
```

Claude irá:
1. Pesquisar arquivos relevantes
2. Analisar padrões existentes
3. Documentar em `docs/research/2025-01-31-sistema-auth.md`

**Depois:** Digite `/clear` para limpar o contexto

#### Etapa 2: Spec (Planejamento)

```bash
# No Claude Code (contexto limpo)
/spec Implementar confirmação de email no cadastro

# Ou referenciando a pesquisa:
/spec docs/research/2025-01-31-sistema-auth.md - adicionar confirmação de email
```

Claude irá:
1. Ler a pesquisa (se fornecida)
2. Criar plano detalhado fase por fase
3. Salvar em `docs/specs/2025-01-31-confirmacao-email-spec.md`

**Depois:** Revise o plano, ajuste se necessário, então `/clear`

#### Etapa 3: Implementação

```bash
# No Claude Code (contexto limpo)
/implement docs/specs/2025-01-31-confirmacao-email-spec.md
```

Claude irá:
1. Ler o plano
2. Executar fase por fase
3. Verificar após cada fase
4. Pausar para testes manuais
5. Continuar até completar

---

## Quando Usar Cada Comando

| Situação | Comando |
|----------|---------|
| Entender como algo funciona | `/research` |
| Planejar nova feature | `/spec` |
| Corrigir bug complexo | `/research` → `/spec` → `/implement` |
| Bug simples e isolado | Pode ir direto (sem workflow) |
| Refatoração | `/research` → `/spec` → `/implement` |

## Dicas de Uso

### 1. Use `/clear` entre etapas
```
/research ...
[Claude pesquisa e gera documento]
/clear  ← IMPORTANTE!
/spec ...
```

### 2. Mantenha o contexto abaixo de 50%
Se a barra de contexto estiver muito cheia, dê `/clear` e comece nova conversa referenciando os documentos.

### 3. Revise os documentos gerados
Os documentos de pesquisa e spec podem ter erros. Revise antes de prosseguir.

### 4. Para features grandes, divida em múltiplas specs
```
Feature: Sistema de Planos Premium

Spec 1: Modelagem de dados (migrations SQL)
Spec 2: API de assinaturas
Spec 3: Integração Stripe
Spec 4: UI de checkout
```

### 5. Referencie pesquisas anteriores
```
/spec Baseado em docs/research/2025-01-30-sistema-pagamentos.md,
      adicionar webhook do Stripe para renovações
```

---

## Stack do OpinaJá (Referência)

| Tecnologia | Uso |
|------------|-----|
| Node.js | Runtime JavaScript |
| Express.js 4.18 | Framework backend |
| PostgreSQL | Banco de dados |
| Raw SQL | Queries (database.js) |
| JWT | Autenticação |
| bcryptjs | Hash de senhas |
| Stripe | Pagamentos/Subscriptions |
| UAZAPI | Integração WhatsApp |
| Nodemailer/Resend | Envio de emails |
| node-cron | Jobs agendados |
| Vanilla HTML/CSS/JS | Frontend (SPA) |
| Railway.app | Deploy/Hosting |

---

## Workflow Visual

```
┌────────────────────────────────────────────────────────────────┐
│                    ANTES (Vibe Coding)                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Usuário: "Implementa login com email"                        │
│     │                                                          │
│     ▼                                                          │
│  [Context Window enchendo...]                                  │
│     │                                                          │
│     ▼                                                          │
│  Código inconsistente, bugs, over-engineering                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    DEPOIS (SDD Workflow)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  /research "sistema de auth"                                   │
│     │                                                          │
│     ▼ (gera Research.md)                                       │
│  /clear                                                        │
│     │                                                          │
│     ▼ (contexto limpo!)                                        │
│  /spec Research.md + "adicionar confirmação email"            │
│     │                                                          │
│     ▼ (gera Spec.md)                                           │
│  /clear                                                        │
│     │                                                          │
│     ▼ (contexto limpo!)                                        │
│  /implement Spec.md                                            │
│     │                                                          │
│     ▼                                                          │
│  Código consistente, testado, documentado                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Estrutura do Projeto OpinaJá

```
review-filter/
├── server.js                 # Express app principal
├── database.js               # Queries SQL e lógica de banco
├── logger.js                 # Logger customizado
├── package.json              # Dependências
├── Procfile                  # Deploy Railway
│
├── middleware/
│   ├── auth.js               # JWT authentication
│   └── subscription.js       # Verificação de planos
│
├── routes/
│   ├── auth.js               # Login, registro, perfil
│   ├── clients.js            # CRUD clientes, tópicos, filiais
│   ├── review.js             # Página pública de reclamação
│   ├── billing.js            # Stripe, assinaturas
│   ├── whatsapp.js           # Instâncias WhatsApp
│   └── admin.js              # Painel administrativo
│
├── services/
│   ├── stripe-service.js     # Integração Stripe
│   ├── whatsapp-service.js   # Integração UAZAPI
│   ├── email-service.js      # Nodemailer/Resend
│   └── cache-service.js      # Cache em memória
│
├── jobs/
│   └── subscription-jobs.js  # Cron jobs (trials, lembretes)
│
├── migrations/
│   ├── 001_whatsapp_instances.sql
│   ├── 002_subscription_fields.sql
│   └── ...
│
├── views/
│   ├── app.html              # SPA principal
│   ├── review.html           # Formulário público
│   ├── login.html            # Autenticação
│   ├── register.html         # Cadastro
│   ├── pricing.html          # Planos
│   └── spa/                   # Fragmentos SPA
│       ├── dashboard.html
│       ├── clients.html
│       └── ...
│
└── public/
    ├── js/app.js             # JavaScript frontend
    ├── css/style.css         # Estilos
    └── images/               # Assets
```

---

## Créditos

- Workflow baseado no trabalho de [Dex Horthy](https://twitter.com/dexhorthy) e [HumanLayer](https://github.com/humanlayer/humanlayer)
- Artigo original: [Como eu uso o Claude Code](https://dfolloni.substack.com/p/como-eu-uso-o-claude-code-workflow) por Deborah Folloni
- Adaptado para OpinaJá por Lucas

---

## Troubleshooting

### Os comandos não aparecem
- Verifique se os arquivos estão em `.claude/commands/`
- Reinicie o Claude Code

### O Claude não segue o formato
- Verifique se o arquivo `.md` está formatado corretamente
- Tente começar uma nova conversa

### Context window enchendo rápido
- Use `/clear` mais frequentemente
- Divida tarefas grandes em menores
- Referencie documentos ao invés de colar conteúdo

---

**Happy coding!**
