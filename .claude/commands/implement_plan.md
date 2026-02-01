# /implement - Implementar Plano OpinaJá

> Comando para implementar um plano aprovado fase por fase.
> **Uso:** `/implement [caminho-para-spec.md]` ou `/implement [fase-específica]`

---

## Instruções para o Claude Code

Você é responsável por implementar um plano técnico aprovado de `docs/specs/`. Estes planos contêm fases com mudanças específicas e critérios de sucesso. Seu trabalho é executar cada fase metodicamente.

### REGRAS FUNDAMENTAIS

- **SIGA O PLANO** - o plano foi revisado e aprovado, siga sua intenção
- **UMA FASE POR VEZ** - complete uma fase totalmente antes de avançar
- **VERIFIQUE SEU TRABALHO** - rode as verificações após cada fase
- **COMUNIQUE DIVERGÊNCIAS** - se algo não bater com o plano, informe antes de prosseguir
- **ATUALIZE CHECKBOXES** - marque os itens completados no plano
- **PAUSE PARA VERIFICAÇÃO MANUAL** - não pule os passos de teste manual

---

## Fluxo de Execução

### Passo 1: Início

Se nenhum plano foi fornecido, pergunte:

```
Vou implementar um plano aprovado.

Qual plano você gostaria de implementar?
Por favor, forneça o caminho para o arquivo de spec.

Dica: Liste os planos disponíveis com:
`ls -lt docs/specs/ | head`
```

Se um plano foi fornecido, leia-o completamente e apresente um resumo.

---

### Passo 2: Leitura e Confirmação do Plano

Após ler o plano:

```
**Plano carregado:** `docs/specs/[nome-do-arquivo].md`

**Título:** [Título do plano]
**Fases:** [Número de fases]
**Arquivos afetados:** [Lista resumida]

**Visão geral das fases:**
1. [ ] Fase 1: [Nome] - [Status]
2. [ ] Fase 2: [Nome] - [Status]
3. [ ] Fase 3: [Nome] - [Status]

Deseja que eu comece pela **Fase 1** ou você quer pular para uma fase específica?
```

---

### Passo 3: Execução de Fase

Para cada fase, siga este processo:

#### 3.1 Anúncio de Início

```
**Iniciando Fase [N]: [Nome da Fase]**

**Objetivo:** [Objetivo da fase]

**Arquivos que serão modificados/criados:**
- `path/to/file1.js` - [Ação]
- `path/to/file2.sql` - [Ação]

Iniciando implementação...
```

#### 3.2 Implementação

Execute as mudanças conforme especificado no plano:

1. **Siga os padrões do codebase** - use os mesmos padrões encontrados na pesquisa
2. **Implemente incrementalmente** - faça uma mudança, verifique, próxima mudança
3. **Mantenha consistência** - nomenclatura, estrutura, formatação
4. **Comente quando necessário** - especialmente em lógica complexa

#### 3.3 Verificação

Após implementar, rode as verificações:

```bash
# Verificações padrão do OpinaJá

# 1. Verificar se servidor inicia
npm start
# (Ctrl+C para parar após confirmar que iniciou)

# 2. Se criou migração, executar
node run-migrations-safe.js

# 3. Testar endpoint (se aplicável)
curl -X GET http://localhost:3000/api/endpoint \
  -H "Cookie: token=SEU_TOKEN"
```

#### 3.4 Relatório de Conclusão da Fase

```
**Fase [N] Completa - Pronta para Verificação Manual**

**Verificações automatizadas:**
- [x] Servidor inicia sem erros
- [x] Migração executada com sucesso (ou N/A)
- [x] Sem erros no console

**Por favor, execute os passos de verificação manual do plano:**
- [ ] [Teste manual 1 do plano]
- [ ] [Teste manual 2 do plano]
- [ ] [Teste manual 3 do plano]

**Teste sugerido:**
```bash
# Comando de teste
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN" \
  -d '{"campo": "valor"}'
```

Me avise quando os testes manuais estiverem completos
para que eu possa prosseguir para a **Fase [N+1]**.
```

---

### Passo 4: Lidando com Divergências

Se algo não bater com o plano, comunique:

```
**Divergência encontrada na Fase [N]:**

**Esperado pelo plano:**
[O que o plano diz]

**Encontrado na realidade:**
[O que você encontrou]

**Por que isso importa:**
[Explicação do impacto]

**Como devo proceder?**
1. [Opção 1]
2. [Opção 2]
```

Aguarde orientação antes de prosseguir.

---

### Passo 5: Atualização do Plano

À medida que completa itens, atualize o arquivo de spec:

```markdown
# Antes
- [ ] Criar endpoint de validação

# Depois
- [x] Criar endpoint de validação
```

---

### Passo 6: Finalização

Após completar todas as fases:

```
**Implementação Completa!**

**Resumo:**
- [x] Fase 1: [Nome] - Completa
- [x] Fase 2: [Nome] - Completa
- [x] Fase 3: [Nome] - Completa

**Arquivos criados:**
- `routes/nova-rota.js`
- `migrations/007_nova_tabela.sql`

**Arquivos modificados:**
- `database.js`
- `server.js`

**Próximos passos:**
1. Revisar as mudanças: `git diff`
2. Testar manualmente o fluxo completo
3. Commitar: `git add . && git commit -m "[mensagem]"`
4. Push (se aplicável)

**Comandos úteis:**
```bash
npm start              # Iniciar servidor
git status             # Ver mudanças
git diff               # Ver diferenças detalhadas
```

Deseja que eu ajude com algo mais relacionado a esta implementação?
```

---

## Tratamento de Erros

### Se o servidor não iniciar:

```
**Erro ao iniciar servidor**

**Erro:**
```
[Mensagem de erro do console]
```

**Análise:**
[O que provavelmente causou o erro]

**Correção proposta:**
[Como pretendo corrigir]

Posso prosseguir com a correção?
```

### Se a migração falhar:

```
**Migração falhou**

**Erro:**
```
[Mensagem de erro]
```

**Possíveis causas:**
1. [Causa 1 - ex: tabela já existe]
2. [Causa 2 - ex: foreign key inválida]

**Recomendação:**
[Como resolver]

Deseja que eu tente [ação]?
```

### Se houver conflito de código:

```
**Conflito de código detectado**

**Arquivo:** `[arquivo.js]`

**Problema:**
[Descrição do conflito]

**Opções:**
1. [Opção 1]
2. [Opção 2]

Como devo proceder?
```

---

## Exemplo de Uso Completo

**Usuário:** `/implement docs/specs/2025-01-31-confirmacao-email-spec.md`

**Claude:**
1. Lê o plano completo
2. Apresenta resumo e pergunta se deve iniciar
3. **Fase 1:** Cria migração SQL
   - Escreve `migrations/007_email_tokens.sql`
   - Executa `node run-migrations-safe.js`
   - Apresenta para verificação
4. **Fase 2:** Atualiza database.js
   - Adiciona funções de token
   - Verifica servidor: `npm start`
   - Apresenta para verificação
5. **Fase 3:** Cria rota de confirmação
   - Atualiza `routes/auth.js`
   - Testa via curl
   - Apresenta para verificação
6. **Fase 4:** Integra envio de email
   - Atualiza registro para enviar email
   - Testa fluxo completo
7. Apresenta resumo final

---

## Comandos Úteis Durante Implementação

```bash
# Servidor
npm start                      # Iniciar servidor
# Ctrl+C para parar

# Migrações
node run-migrations-safe.js    # Executar todas as migrações
node run-migrations-env.js     # Usar DATABASE_URL do .env

# Banco de dados (se tiver psql)
psql $DATABASE_URL             # Conectar ao banco
\dt                            # Listar tabelas
\d nome_tabela                 # Descrever tabela

# Verificar migração específica
psql $DATABASE_URL -c "SELECT * FROM information_schema.tables WHERE table_name = 'nova_tabela';"

# Git
git status                     # Ver mudanças
git diff                       # Ver diferenças
git add .                      # Adicionar tudo
git commit -m "msg"            # Commitar
git stash                      # Guardar mudanças temporariamente
git stash pop                  # Recuperar mudanças guardadas

# Testes via curl
# GET autenticado
curl http://localhost:3000/api/endpoint \
  -H "Cookie: token=SEU_TOKEN"

# POST autenticado
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN" \
  -d '{"campo": "valor"}'

# GET público
curl http://localhost:3000/r/slug/data

# Ver logs do servidor em tempo real
npm start 2>&1 | tee server.log
```

---

## Padrões de Código OpinaJá

### Padrão de Rota Express
```javascript
// routes/[recurso].js
const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// GET - Listar
router.get('/', authMiddleware, async (req, res) => {
    try {
        const dados = await db.getDados(req.userId);
        res.json({ success: true, data: dados });
    } catch (error) {
        console.error('[GET_DADOS_ERROR]', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST - Criar
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { campo } = req.body;

        // Validação
        if (!campo) {
            return res.status(400).json({ error: 'Campo obrigatório' });
        }

        const resultado = await db.createDado(req.userId, campo);
        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error('[CREATE_DADO_ERROR]', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT - Atualizar
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { campo } = req.body;

        const resultado = await db.updateDado(id, req.userId, campo);

        if (!resultado) {
            return res.status(404).json({ error: 'Não encontrado' });
        }

        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error('[UPDATE_DADO_ERROR]', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE - Remover
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await db.deleteDado(id, req.userId);

        if (!deleted) {
            return res.status(404).json({ error: 'Não encontrado' });
        }

        res.json({ success: true, message: 'Removido com sucesso' });
    } catch (error) {
        console.error('[DELETE_DADO_ERROR]', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
```

### Padrão de Função database.js
```javascript
// Leitura
async function getDados(userId) {
    const result = await pool.query(
        `SELECT * FROM tabela
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows;
}

// Leitura por ID
async function getDadoById(id, userId) {
    const result = await pool.query(
        'SELECT * FROM tabela WHERE id = $1 AND user_id = $2',
        [id, userId]
    );
    return result.rows[0];
}

// Criação
async function createDado(userId, campo) {
    const result = await pool.query(
        `INSERT INTO tabela (user_id, campo)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, campo]
    );
    return result.rows[0];
}

// Atualização
async function updateDado(id, userId, campo) {
    const result = await pool.query(
        `UPDATE tabela
         SET campo = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [campo, id, userId]
    );
    return result.rows[0];
}

// Deleção
async function deleteDado(id, userId) {
    const result = await pool.query(
        'DELETE FROM tabela WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
    );
    return result.rowCount > 0;
}
```

### Padrão de Migração SQL
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nova_tabela_user ON nova_tabela(user_id);

-- Adicionar coluna em tabela existente
ALTER TABLE users ADD COLUMN IF NOT EXISTS novo_campo VARCHAR(255);

-- Inserir dados iniciais
INSERT INTO platform_settings (key, value) VALUES
    ('nova_config', 'valor_padrao')
ON CONFLICT (key) DO NOTHING;
```

---

## Notas Importantes

1. **Não pule verificações** - cada verificação existe por um motivo
2. **Comunique problemas cedo** - é melhor perguntar que assumir
3. **O plano é um guia** - use seu julgamento se a realidade divergir
4. **Mantenha commits pequenos** - facilita debugging e rollback
5. **Documente decisões** - se mudar algo do plano, explique por quê
6. **Use queries parametrizadas** - sempre $1, $2... nunca concatene strings
7. **Teste no banco real** - se possível, teste com dados reais
