---
description: Template rápido para correção de bugs no Opina Já!
model: sonnet
comando: /fix [descrição-curta]
---

# 🐛 Template: Correção de Bug

## Contexto do Projeto

```yaml
Sistema: Opina Já! - SaaS de gestão de reviews
Stack: Next.js 14, Node.js, Prisma, PostgreSQL
Integrações: WhatsApp, OpenAI (sentimento), Google Reviews
```

---

## Quando Usar Este Template

- ✅ Bug identificado que precisa ser corrigido
- ✅ Problema pontual (não requer refatoração grande)
- ✅ Causa raiz é relativamente clara ou localizável
- ✅ Fix estimado em menos de 2-3 horas

**Para bugs complexos ou que requerem mudanças estruturais, use `/planejar` primeiro.**

---

## Processo de Correção

### Passo 1: Coletar Informações do Bug

Se informações insuficientes:

```
Para corrigir esse bug, preciso de mais detalhes:

## 🐛 Descreva o Bug

**1. O que está acontecendo? (comportamento atual)**
[Descreva o problema]

**2. O que deveria acontecer? (comportamento esperado)**
[Descreva o correto]

**3. Como reproduzir?**
1. [Passo 1]
2. [Passo 2]
3. [Erro aparece]

**4. Mensagem de erro (se houver)**
```
[Cole logs, erros do console, etc.]
```

**5. Onde você suspeita que está o problema? (opcional)**
[Arquivo ou área do código]

---

Quanto mais detalhes, mais rápido consigo corrigir!
```

---

### Passo 2: Documentar o Bug

Após receber informações:

```markdown
## 🐛 Bug Report

### ID: BUG-YYYY-MM-DD-[numero]

### Descrição
[Uma frase resumindo o bug]

### Comportamento Atual (Bug)
[O que está acontecendo de errado]

### Comportamento Esperado
[O que deveria acontecer]

### Passos para Reproduzir
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]
4. Erro: [descrição do erro]

### Ambiente
- [ ] Desenvolvimento local
- [ ] Staging
- [ ] Produção

### Logs/Erros
```
[Mensagens de erro relevantes]
```

### Arquivos Suspeitos
- `src/[caminho]/arquivo.ts` - [motivo da suspeita]

### Severidade
- [ ] 🔴 Crítico (sistema inoperante)
- [ ] 🟠 Alto (funcionalidade principal quebrada)
- [ ] 🟡 Médio (funcionalidade secundária afetada)
- [ ] 🟢 Baixo (inconveniência menor)
```

---

### Passo 3: Investigar Causa Raiz

```
## 🔍 Investigação

### Arquivos Analisados
Lendo arquivos relacionados COMPLETAMENTE...

- [ ] `arquivo1.ts` - [status]
- [ ] `arquivo2.ts` - [status]
- [ ] `arquivo3.ts` - [status]
```

#### Checklist de Investigação

```
⚠️ REGRAS:
- Ler arquivos COMPLETOS (sem limit/offset)
- Não assumir - verificar
- Seguir o fluxo de dados
- Checar logs e tratamento de erros
```

#### Perguntas a Responder

1. **Onde o erro acontece?**
   - Arquivo: `___`
   - Linha: `___`
   - Função: `___`

2. **Por que acontece?**
   - Causa direta: `___`
   - Causa raiz: `___`

3. **Quando começou?** (se souber)
   - Commit/PR: `___`
   - Data aproximada: `___`

4. **Quem/o que é afetado?**
   - Usuários: `___`
   - Funcionalidades: `___`

---

### Passo 4: Apresentar Diagnóstico

```
## 🎯 Diagnóstico

### Causa Raiz Identificada

**Arquivo**: `src/services/review.service.ts`
**Linha**: 45-52
**Problema**: [Explicação clara do que está errado]

### Código Problemático
```typescript
// src/services/review.service.ts:45-52
async function processReview(data) {
  // ❌ Problema: não valida se data.rating existe
  const rating = data.rating;  // undefined quando não enviado
  return calculateScore(rating); // erro aqui
}
```

### Por que isso causa o bug
[Explicação de como esse código leva ao comportamento observado]

### Solução Proposta
```typescript
// ✅ Correção
async function processReview(data) {
  // Validar antes de usar
  if (!data.rating) {
    throw new Error('Rating é obrigatório');
  }
  const rating = data.rating;
  return calculateScore(rating);
}
```

### Impacto da Correção
- Arquivos afetados: [N]
- Risco de regressão: [Baixo/Médio/Alto]
- Testes necessários: [Lista]

---

Posso prosseguir com essa correção?
```

**Aguarde confirmação antes de implementar.**

---

### Passo 5: Implementar Correção

Após aprovação:

```
## 🔧 Implementando Correção

### Mudanças Realizadas

#### 1. [Arquivo modificado]
**Arquivo**: `src/services/review.service.ts`
**Mudança**: [Descrição]

```diff
- // Código antigo
- const rating = data.rating;
+ // Código novo - com validação
+ if (!data.rating) {
+   throw new Error('Rating é obrigatório');
+ }
+ const rating = data.rating;
```

#### 2. [Outro arquivo, se houver]
...

### Teste Adicionado (se aplicável)
```typescript
// __tests__/review.service.test.ts
describe('processReview', () => {
  it('deve lançar erro quando rating não fornecido', () => {
    expect(() => processReview({})).toThrow('Rating é obrigatório');
  });
});
```
```

---

### Passo 6: Verificar Correção

```
## ✅ Verificação

### Automatizada

```bash
# Executando verificações...
npx prisma validate  # Se alterou schema
npm run build        # Verificar tipos
npm run lint         # Verificar lint  
npm test             # Rodar testes
```

| Check | Status |
|-------|--------|
| Prisma | ✅ |
| Build | ✅ |
| Lint | ✅ |
| Testes | ✅ (25/25) |

### Manual

Por favor, verifique:

1. **Reproduzir o bug original**
   - Passos: [mesmos do bug report]
   - Esperado: [não deve mais ocorrer]

2. **Testar cenários relacionados**
   - [ ] [Cenário 1]
   - [ ] [Cenário 2]

3. **Verificar que não quebrou nada**
   - [ ] [Funcionalidade relacionada 1]
   - [ ] [Funcionalidade relacionada 2]

---

⏳ Aguardando confirmação que o bug foi corrigido.
```

---

### Passo 7: Documentar e Fechar

Após confirmação:

```
## 🎉 Bug Corrigido!

### Resumo

| Item | Detalhe |
|------|---------|
| Bug | [Descrição curta] |
| Causa | [Causa raiz] |
| Solução | [O que foi feito] |
| Arquivos | [Lista] |
| Testes | [Adicionados/Modificados] |

### Arquivos Modificados
- `src/services/review.service.ts` - Adicionada validação
- `__tests__/review.service.test.ts` - Novo teste

### Prevenção Futura
[Sugestão para evitar bugs similares, se aplicável]

### Documentação
Salvo em: `docs/bugs/YYYY-MM-DD-descricao.md`

---

Bug corrigido e verificado! ✅
```

---

## Template de Documento de Bug

Salvar em: `docs/bugs/YYYY-MM-DD-[descricao-kebab].md`

```markdown
---
data: YYYY-MM-DD
status: resolvido
severidade: [critico|alto|medio|baixo]
arquivos: [lista de arquivos]
---

# Bug: [Título Descritivo]

## Descrição
[O que era o bug]

## Causa Raiz
**Arquivo**: `caminho/arquivo.ts:linha`
**Problema**: [Explicação técnica]

## Solução
[O que foi feito para corrigir]

## Código

### Antes
```typescript
// Código problemático
```

### Depois
```typescript
// Código corrigido
```

## Testes
- [x] Teste unitário adicionado
- [x] Bug não reproduz mais
- [x] Sem regressões

## Lições Aprendidas
[O que aprendemos / como prevenir no futuro]
```

---

## Bugs de Emergência (Hotfix)

Para bugs críticos em produção:

```
## 🚨 HOTFIX EMERGENCIAL

### Situação
- **Severidade**: CRÍTICA
- **Impacto**: [Descrever impacto]
- **Usuários afetados**: [Número/porcentagem]

### Ação Imediata
1. [ ] Notificar time/stakeholders
2. [ ] Avaliar rollback como opção
3. [ ] Implementar fix mínimo
4. [ ] Deploy emergencial

### Fix Mínimo
[Menor mudança possível para resolver]

### Fix Completo (depois)
[Solução robusta para implementar após estabilizar]

---

⚠️ Prioridade: Estabilizar primeiro, refinar depois.
```

---

## Checklist de Correção de Bug

### Investigação
- [ ] Bug documentado com passos para reproduzir
- [ ] Arquivos relevantes lidos COMPLETAMENTE
- [ ] Causa raiz identificada
- [ ] Diagnóstico apresentado ao usuário

### Implementação
- [ ] Correção aprovada antes de implementar
- [ ] Código modificado conforme diagnóstico
- [ ] Teste adicionado para prevenir regressão

### Verificação
- [ ] Verificação automatizada passou
- [ ] Bug não reproduz mais (confirmado pelo usuário)
- [ ] Funcionalidades relacionadas testadas
- [ ] Nenhuma regressão identificada

### Documentação
- [ ] Bug documentado em `docs/bugs/`
- [ ] Lições aprendidas registradas

---

## Comandos Úteis para Debug

```bash
# ═══════════════════════════════════════════
# LOGS E DEBUG
# ═══════════════════════════════════════════
# Ver logs do Next.js
npm run dev 2>&1 | tee debug.log

# Logs do Prisma (queries)
DEBUG="prisma:query" npm run dev

# ═══════════════════════════════════════════
# BANCO DE DADOS
# ═══════════════════════════════════════════
# Abrir studio para inspecionar dados
npx prisma studio

# Ver estado das migrações
npx prisma migrate status

# ═══════════════════════════════════════════
# TESTES ESPECÍFICOS
# ═══════════════════════════════════════════
# Rodar teste específico
npm test -- --testPathPattern="nome"

# Rodar com debug
node --inspect-brk node_modules/.bin/jest --runInBand

# ═══════════════════════════════════════════
# TYPESCRIPT
# ═══════════════════════════════════════════
# Verificar tipos
npx tsc --noEmit

# Ver erros detalhados
npx tsc --noEmit --pretty
```
