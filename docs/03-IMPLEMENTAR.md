---
description: Implementar planos aprovados do Opina Já! com verificação
model: sonnet
comando: /implementar [caminho-do-plano]
---

# 🚀 Template: Implementar Plano

## Contexto do Projeto

```yaml
Sistema: Opina Já! - SaaS de gestão de reviews
Stack: Next.js 14, Node.js, Prisma, PostgreSQL
Integrações: WhatsApp, OpenAI (sentimento), Google Reviews
```

---

## REGRAS FUNDAMENTAIS

> 1. **Siga o plano** - O plano foi aprovado, execute-o
> 2. **Leia TUDO** - Arquivos completos, sem limit/offset
> 3. **Uma fase por vez** - Complete e verifique antes de avançar
> 4. **Pause para humano** - Verificação manual requer confirmação
> 5. **Documente desvios** - Se algo não bater, PARE e comunique

---

## Quando Usar Este Template

- ✅ Existe um plano aprovado em `docs/plans/`
- ✅ O plano já foi revisado e validado
- ✅ Você está pronto para codificar

---

## Processo de Implementação

### Passo 1: Receber o Plano

Se nenhum plano foi fornecido:

```
Para implementar, preciso do caminho do plano aprovado.

Exemplo:
/implementar docs/plans/2024-01-15-whatsapp-integration.md

Ou me diga qual feature você quer implementar e 
eu procuro o plano correspondente.
```

**Aguarde o caminho do plano.**

---

### Passo 2: Leitura Inicial

Ao receber o plano:

```
⚠️ CHECKLIST DE LEITURA INICIAL:

1. [ ] Ler o plano COMPLETAMENTE
2. [ ] Identificar checkboxes já marcados (- [x])
3. [ ] Ler TODOS os arquivos mencionados no plano
4. [ ] Entender o estado desejado
5. [ ] Criar lista de tarefas pessoal
```

**Leia SEM limit/offset. Arquivos inteiros.**

---

### Passo 3: Verificar Progresso Existente

Se o plano tem checkboxes marcados:

```
## 📊 Status do Plano

### Já Concluído
- [x] Fase 1: [Nome] ✅
- [x] Fase 2: [Nome] ✅

### Pendente
- [ ] Fase 3: [Nome] ⬅️ Começar aqui
- [ ] Fase 4: [Nome]

---

Vou continuar a partir da Fase 3.
Confirma que posso prosseguir?
```

**Se algo parecer errado no trabalho anterior, verifique antes de continuar.**

---

### Passo 4: Executar Fase

Para cada fase do plano:

#### 4.1 Anunciar Início

```
## 🔨 Iniciando Fase [N]: [Nome da Fase]

### Objetivo
[Copiar objetivo do plano]

### Arquivos a modificar
- `arquivo1.ts` - [ação]
- `arquivo2.ts` - [ação]

### Minha lista de tarefas
- [ ] [Tarefa 1]
- [ ] [Tarefa 2]
- [ ] [Tarefa 3]

Começando implementação...
```

#### 4.2 Implementar

- Siga as instruções do plano
- Use o código de exemplo como guia
- Mantenha os padrões do projeto
- Atualize sua lista de tarefas conforme avança

#### 4.3 Quando Algo Não Bate

Se encontrar discrepância entre o plano e a realidade:

```
## ⚠️ Discrepância Encontrada

### Fase: [N] - [Nome]

### O plano diz:
[Copiar trecho relevante do plano]

### O que encontrei:
[Descrever a situação real]

### Por que isso importa:
[Explicar o impacto]

### Opções:
1. [Opção A] - [prós/contras]
2. [Opção B] - [prós/contras]

---

Como devo proceder?
```

**PARE e aguarde orientação. Não improvise.**

---

### Passo 5: Verificação da Fase

Após implementar todos os itens da fase:

#### 5.1 Executar Verificações Automatizadas

```bash
# Executar na ordem:

# 1. Validar Prisma (se alterou schema)
npx prisma validate
npx prisma generate

# 2. Aplicar migrações (se necessário)
npx prisma migrate dev --name nome-da-migracao

# 3. Verificar tipos
npm run build
# ou
npx tsc --noEmit

# 4. Verificar lint
npm run lint

# 5. Rodar testes
npm test
```

#### 5.2 Reportar Resultado Automatizado

```
## ✅ Verificação Automatizada - Fase [N]

| Check | Status | Detalhes |
|-------|--------|----------|
| Prisma Validate | ✅ | Schema válido |
| Prisma Migrate | ✅ | Migração aplicada |
| TypeScript Build | ✅ | Sem erros de tipo |
| ESLint | ✅ | Sem warnings |
| Testes | ✅ | 24/24 passando |

Todos os checks automatizados passaram.
```

Se algum falhar:

```
## ❌ Falha na Verificação Automatizada

### Check que falhou: [Nome]

### Erro:
```
[Copiar mensagem de erro]
```

### Análise:
[Explicar o que provavelmente causou]

### Correção:
[O que vou fazer para corrigir]

---

Corrigindo e rodando novamente...
```

**Corrija até todos passarem.**

---

### Passo 6: Solicitar Verificação Manual

Após verificação automatizada passar:

```
## ⏸️ Fase [N] Completa - Aguardando Verificação Manual

### ✅ Verificação Automatizada
Todos os checks passaram:
- Prisma: ✅
- Build: ✅
- Lint: ✅
- Testes: ✅

### 👁️ Verificação Manual Necessária

Por favor, execute os seguintes testes:

1. **[Teste 1]**
   - Passos: [descrição]
   - Esperado: [resultado]

2. **[Teste 2]**
   - Passos: [descrição]
   - Esperado: [resultado]

3. **[Teste 3]**
   - Passos: [descrição]
   - Esperado: [resultado]

---

⏳ Aguardando sua confirmação para prosseguir à Fase [N+1].

Responda:
- ✅ "OK" ou "Passou" - para continuar
- ❌ "Falhou: [descrição]" - para corrigir algo
```

**NÃO prossiga sem confirmação humana.**

---

### Passo 7: Atualizar Plano

Após confirmação de cada fase:

```markdown
# No arquivo do plano, marcar como concluído:

## Fase 1: [Nome]
...
### Critérios de Sucesso - Fase 1

#### ✅ Verificação Automatizada
- [x] Prisma válido ✅ 2024-01-15
- [x] TypeScript compila ✅ 2024-01-15
- [x] Lint passa ✅ 2024-01-15
- [x] Testes passam ✅ 2024-01-15

#### 👁️ Verificação Manual
- [x] [Teste manual 1] ✅ Confirmado pelo usuário
- [x] [Teste manual 2] ✅ Confirmado pelo usuário
```

---

### Passo 8: Próxima Fase ou Conclusão

#### Se há mais fases:

```
## ✅ Fase [N] Concluída

Plano atualizado com checkboxes marcados.

---

## 🔨 Iniciando Fase [N+1]: [Nome]

[Repetir processo...]
```

#### Se todas as fases concluídas:

```
## 🎉 Implementação Concluída!

### Resumo

| Fase | Status | Data |
|------|--------|------|
| Fase 1: [Nome] | ✅ Concluída | 2024-01-15 |
| Fase 2: [Nome] | ✅ Concluída | 2024-01-15 |
| Fase 3: [Nome] | ✅ Concluída | 2024-01-16 |

### Arquivos Modificados
- `src/services/review.service.ts` - [mudança]
- `src/app/api/reviews/route.ts` - [mudança]
- `prisma/schema.prisma` - [mudança]

### Próximos Passos Recomendados
1. [ ] Deploy para ambiente de staging
2. [ ] Testes de aceitação com usuários
3. [ ] Monitorar logs após deploy em produção

### Documentação
- Plano: `docs/plans/YYYY-MM-DD-feature.md`
- Relacionados: [outros docs]

---

Precisa de algo mais relacionado a essa implementação?
```

---

## Retomando Trabalho Interrompido

Se você parou no meio de uma implementação:

```
## 🔄 Retomando Implementação

### Plano: `docs/plans/YYYY-MM-DD-feature.md`

### Status encontrado:
- [x] Fase 1: Concluída
- [x] Fase 2: Concluída
- [ ] Fase 3: **Em andamento** ⬅️
  - [x] Arquivo 1 modificado
  - [ ] Arquivo 2 pendente
  - [ ] Testes pendentes
- [ ] Fase 4: Pendente

### Última ação:
[Descrever o que foi feito por último]

### Próxima ação:
[Descrever o que falta na fase atual]

---

Confirma que posso continuar de onde parou?
```

---

## Tratamento de Erros Comuns

### Erro de Migração Prisma

```bash
# Se migração falhar
npx prisma migrate reset  # CUIDADO: apaga dados locais
npx prisma migrate dev

# Se houver conflito
npx prisma migrate resolve --applied "nome_da_migracao"
```

### Erro de Tipos TypeScript

```bash
# Regenerar tipos do Prisma
npx prisma generate

# Limpar cache
rm -rf .next
npm run build
```

### Testes Falhando

```bash
# Rodar teste específico
npm test -- --testPathPattern="nome-do-arquivo"

# Rodar com verbose
npm test -- --verbose

# Atualizar snapshots (se aplicável)
npm test -- --updateSnapshot
```

---

## Comandos de Referência

```bash
# ═══════════════════════════════════════════
# BANCO DE DADOS
# ═══════════════════════════════════════════
npx prisma validate          # Validar schema
npx prisma format            # Formatar schema
npx prisma generate          # Gerar client
npx prisma migrate dev       # Criar/aplicar migração
npx prisma migrate reset     # Reset completo (CUIDADO)
npx prisma studio            # UI visual do banco

# ═══════════════════════════════════════════
# BUILD E VERIFICAÇÃO
# ═══════════════════════════════════════════
npm run build                # Build completo
npm run lint                 # Verificar lint
npm run lint:fix             # Corrigir lint auto
npx tsc --noEmit             # Verificar tipos sem build

# ═══════════════════════════════════════════
# TESTES
# ═══════════════════════════════════════════
npm test                     # Rodar todos os testes
npm run test:watch           # Modo watch
npm run test:coverage        # Com cobertura
npm test -- --testPathPattern="arquivo"  # Teste específico

# ═══════════════════════════════════════════
# DESENVOLVIMENTO
# ═══════════════════════════════════════════
npm run dev                  # Servidor dev
npm start                    # Servidor produção
```

---

## Checklist de Implementação

### Antes de Começar
- [ ] Plano foi lido COMPLETAMENTE
- [ ] Todos os arquivos do plano foram lidos
- [ ] Entendo o estado desejado
- [ ] Criei minha lista de tarefas

### Durante Cada Fase
- [ ] Anunciei início da fase
- [ ] Implementei conforme o plano
- [ ] Documentei qualquer desvio
- [ ] Verificação automatizada passou
- [ ] Solicitei verificação manual
- [ ] Recebi confirmação humana
- [ ] Atualizei checkboxes no plano

### Ao Finalizar
- [ ] Todas as fases concluídas
- [ ] Plano totalmente marcado como feito
- [ ] Resumo final apresentado
- [ ] Próximos passos sugeridos
