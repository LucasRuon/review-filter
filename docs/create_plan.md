# /spec - Criar Plano de Implementação OpinaJá

> Comando para criar um plano detalhado de implementação baseado na pesquisa realizada.
> **Uso:** `/spec [descrição da tarefa]` ou `/spec [caminho-para-research.md]`

---

## Instruções para o Claude Code

Você é responsável por criar um plano de implementação detalhado e tático. Este plano será usado na próxima etapa para guiar a implementação real.

### REGRAS FUNDAMENTAIS

- **LEIA** primeiro qualquer documento de pesquisa relacionado
- **SEJA ESPECÍFICO** - liste exatamente quais arquivos criar/modificar
- **SEJA TÁTICO** - descreva exatamente o que fazer em cada arquivo
- **INCLUA CODE SNIPPETS** quando necessário para mostrar o padrão desejado
- **DIVIDA EM FASES** - fases pequenas e verificáveis
- **DEFINA CRITÉRIOS DE SUCESSO** - como saber se funcionou

---

## Fluxo de Execução

### Passo 1: Início

Diga exatamente:

```
Vou criar um plano de implementação detalhado.

Por favor, forneça:
1. A descrição da tarefa ou referência a um documento de pesquisa
2. Qualquer contexto relevante, restrições ou requisitos específicos
3. Links para pesquisas relacionadas ou implementações anteriores

Dica: Você pode invocar este comando com um arquivo de pesquisa:
`/spec docs/research/2025-01-31-sistema-autenticacao.md`
```

Aguarde a entrada do usuário.

---

### Passo 2: Análise do Contexto

#### Se um documento de pesquisa foi fornecido:
1. **Leia o documento completo**
2. **Extraia** os arquivos relevantes identificados
3. **Identifique** os padrões de implementação existentes
4. **Note** as tecnologias e integrações envolvidas

#### Se apenas uma descrição foi fornecida:
1. **Faça perguntas de esclarecimento** se necessário
2. **Identifique** os componentes que serão afetados
3. **Pesquise rapidamente** padrões existentes na base de código

---

### Passo 3: Perguntas de Esclarecimento (se necessário)

Antes de criar o plano, faça perguntas para garantir clareza:

```
Antes de criar o plano, preciso esclarecer alguns pontos:

1. [Pergunta sobre escopo]
2. [Pergunta sobre comportamento esperado]
3. [Pergunta sobre edge cases]

Por favor, responda para que eu possa criar um plano preciso.
```

---

### Passo 4: Geração do Plano

Crie o documento em `docs/specs/` com a seguinte estrutura:

**Nome do arquivo:** `YYYY-MM-DD-[descrição-curta]-spec.md`

**Exemplo:** `2025-01-31-confirmacao-email-spec.md`

```markdown
---
date: [Data e hora atual ISO]
author: Claude
status: draft
ticket: [ID do ticket se houver]
research: [Link para documento de pesquisa relacionado]
---

# Spec: [Título Descritivo da Feature/Fix]

**Data**: [Data]
**Baseado em**: [Link para research se houver]
**Estimativa**: [Pequena/Média/Grande]

## Objetivo

[Descrição clara e concisa do que será implementado e por quê]

## Escopo

### Incluído
- [O que está incluído nesta implementação]
- [Item 2]

### Não Incluído
- [O que explicitamente NÃO faz parte desta implementação]
- [Item 2]

## Pré-requisitos

- [ ] [Dependência ou configuração necessária]
- [ ] [Item 2]

---

## Fases de Implementação

### Fase 1: [Nome Descritivo]

**Objetivo:** [O que esta fase alcança]

#### Arquivos a Modificar:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `database.js` | Modificar | [Adicionar função X] |
| `routes/nova-rota.js` | Criar | [Nova rota para Y] |
| `migrations/007_nova_tabela.sql` | Criar | [Migração para Z] |

#### Detalhes de Implementação:

**1. `migrations/007_nova_tabela.sql`**

Criar migração SQL:
```sql
-- Nova tabela
CREATE TABLE IF NOT EXISTS nova_tabela (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    campo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_nova_tabela_user ON nova_tabela(user_id);
```

**2. `database.js`**

Adicionar função:
```javascript
// Adicionar nova função
async function createNovoRegistro(userId, campo) {
    const result = await pool.query(
        'INSERT INTO nova_tabela (user_id, campo) VALUES ($1, $2) RETURNING *',
        [userId, campo]
    );
    return result.rows[0];
}

// Exportar no module.exports
module.exports = {
    // ... funções existentes
    createNovoRegistro
};
```

**3. `routes/nova-rota.js`**

Criar nova rota:
```javascript
const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// POST /api/novo-recurso
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { campo } = req.body;

        if (!campo) {
            return res.status(400).json({ error: 'Campo obrigatório' });
        }

        const registro = await db.createNovoRegistro(req.userId, campo);
        res.json({ success: true, data: registro });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
```

**4. `server.js`**

Registrar a rota:
```javascript
// Adicionar após as outras rotas
const novaRota = require('./routes/nova-rota');
app.use('/api/novo-recurso', novaRota);
```

#### Critérios de Sucesso - Fase 1:

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros: `npm start`
- [ ] Migração executa com sucesso: `node run-migrations-safe.js`
- [ ] Sem erros no console durante inicialização

**Verificação Manual:**
- [ ] [Teste manual específico via curl ou browser]
- [ ] [Outro teste manual]

**Teste via curl:**
```bash
# Testar endpoint (ajustar token)
curl -X POST http://localhost:3000/api/novo-recurso \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN" \
  -d '{"campo": "valor teste"}'
```

---

### Fase 2: [Nome Descritivo]

**Objetivo:** [O que esta fase alcança]

[Mesma estrutura da Fase 1]

---

### Fase 3: [Nome Descritivo]

[Continuar conforme necessário]

---

## Arquivos Afetados (Resumo)

### Novos Arquivos:
- `routes/nova-rota.js` - [Descrição]
- `migrations/007_nova_tabela.sql` - [Descrição]

### Arquivos Modificados:
- `database.js` - [O que muda]
- `server.js` - [O que muda]

### Arquivos de Frontend (se aplicável):
- `views/spa/nova-pagina.html` - [Descrição]
- `public/js/app.js` - [O que muda]

---

## Migrações de Banco de Dados

```bash
# Executar migrações
node run-migrations-safe.js

# Ou executar SQL específico manualmente via psql
psql $DATABASE_URL -f migrations/007_nova_tabela.sql
```

### Verificar no Banco:
```sql
-- Verificar se tabela foi criada
SELECT * FROM information_schema.tables
WHERE table_name = 'nova_tabela';

-- Verificar colunas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'nova_tabela';
```

---

## Variáveis de Ambiente

```env
# Novas variáveis necessárias (adicionar ao .env)
NOVA_VARIAVEL=valor
```

---

## Considerações de Segurança

- [ ] [Consideração de segurança 1]
- [ ] [Consideração de segurança 2]
- [ ] Validação de input implementada
- [ ] Autenticação verificada (authMiddleware)
- [ ] SQL injection prevenido (queries parametrizadas)

---

## Edge Cases

| Cenário | Comportamento Esperado |
|---------|----------------------|
| [Cenário 1] | [O que deve acontecer] |
| [Cenário 2] | [O que deve acontecer] |
| Usuário não autenticado | Retorna 401 |
| Dados inválidos | Retorna 400 com mensagem |

---

## Rollback

Em caso de problemas:
1. Reverter código via git: `git checkout -- .`
2. Se migração foi executada, rodar rollback SQL:
```sql
-- Reverter migração
DROP TABLE IF EXISTS nova_tabela;
```

---

## Checklist Final

- [ ] Todas as fases implementadas
- [ ] Servidor inicia sem erros
- [ ] Migrações executadas com sucesso
- [ ] Testes manuais passando
- [ ] Documentação atualizada (se necessário)
- [ ] Variáveis de ambiente configuradas
```

---

### Passo 5: Apresentação do Plano

Após criar o documento, apresente:

```
Criei o plano de implementação em: `docs/specs/YYYY-MM-DD-[nome]-spec.md`

**Resumo:**
- [Número] fases de implementação
- [Número] arquivos novos
- [Número] arquivos modificados
- Estimativa: [Pequena/Média/Grande]

**Fases:**
1. [Nome da Fase 1] - [Descrição curta]
2. [Nome da Fase 2] - [Descrição curta]
3. [...]

Por favor, revise o plano e me diga:
- As fases estão bem dimensionadas?
- Os critérios de sucesso são específicos o suficiente?
- Algum detalhe técnico precisa de ajuste?
- Faltou considerar algum edge case?
```

---

## Exemplo de Uso

**Usuário:** `/spec Implementar confirmação de email no cadastro`

**Claude:**
1. Pesquisa padrões de autenticação existentes em `routes/auth.js`
2. Faz perguntas de esclarecimento (qual serviço de email? prazo de expiração?)
3. Cria plano com fases:
   - Fase 1: Criar migração para token de confirmação
   - Fase 2: Atualizar database.js com funções de token
   - Fase 3: Criar rota de confirmação em routes/auth.js
   - Fase 4: Integrar envio de email no registro
4. Gera documento em `docs/specs/2025-01-31-confirmacao-email-spec.md`

---

## Convenções do OpinaJá

### Estrutura de Rotas Express
```javascript
// routes/[recurso].js
const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// GET /api/recurso
router.get('/', authMiddleware, async (req, res) => {
    try {
        const dados = await db.getDados(req.userId);
        res.json({ success: true, data: dados });
    } catch (error) {
        console.error('[ROTA_ERROR]', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/recurso
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { campo } = req.body;

        if (!campo) {
            return res.status(400).json({ error: 'Campo obrigatório' });
        }

        const resultado = await db.createDado(req.userId, campo);
        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error('[ROTA_ERROR]', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
```

### Estrutura de Funções database.js
```javascript
// Função de leitura
async function getDados(userId) {
    const result = await pool.query(
        'SELECT * FROM tabela WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}

// Função de escrita
async function createDado(userId, campo) {
    const result = await pool.query(
        'INSERT INTO tabela (user_id, campo) VALUES ($1, $2) RETURNING *',
        [userId, campo]
    );
    return result.rows[0];
}

// Função de atualização
async function updateDado(id, userId, campo) {
    const result = await pool.query(
        'UPDATE tabela SET campo = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
        [campo, id, userId]
    );
    return result.rows[0];
}
```

### Estrutura de Migração SQL
```sql
-- migrations/00X_descricao.sql

-- Criar tabela
CREATE TABLE IF NOT EXISTS nova_tabela (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    campo VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_nova_tabela_user ON nova_tabela(user_id);
CREATE INDEX IF NOT EXISTS idx_nova_tabela_ativo ON nova_tabela(ativo);

-- Adicionar coluna em tabela existente
ALTER TABLE users ADD COLUMN IF NOT EXISTS novo_campo VARCHAR(255);
```

### Comandos Padrão
```bash
npm start                    # Iniciar servidor
npm run dev                  # Desenvolvimento (se configurado)
node run-migrations-safe.js  # Executar migrações
node run-migrations-env.js   # Migrações com URL do .env
```

---

## Notas Importantes

1. **Planos são guias, não leis** - adapte durante a implementação se necessário
2. **Fases pequenas** - é melhor ter mais fases pequenas que poucas fases grandes
3. **Critérios mensuráveis** - cada fase deve ter critérios claros de sucesso
4. **Code snippets** - inclua exemplos de código quando o padrão não for óbvio
5. **Preserve contexto** - o plano deve ser compreensível sem ler o código
6. **Queries parametrizadas** - sempre use $1, $2... para prevenir SQL injection
