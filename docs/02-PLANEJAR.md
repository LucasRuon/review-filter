---
description: Criar planos de implementação detalhados para Opina Já!
model: opus
comando: /planejar [feature|update|fix]
---

# 📋 Template: Criar Plano de Implementação

## Contexto do Projeto

```yaml
Sistema: Opina Já! - SaaS de gestão de reviews
Stack: Next.js 14, Node.js, Prisma, PostgreSQL
Integrações: WhatsApp, OpenAI (sentimento), Google Reviews
Preço: ~R$89,90/mês
```

---

## REGRAS FUNDAMENTAIS

> 1. **Processo INTERATIVO** - Não escreva o plano todo de uma vez
> 2. **Valide cada etapa** - Obtenha confirmação antes de avançar
> 3. **Seja cético** - Questione requisitos vagos
> 4. **Zero perguntas abertas** - Resolva TUDO antes de finalizar o plano

---

## Quando Usar Este Template

- ✅ Nova feature a ser desenvolvida
- ✅ Refatoração significativa
- ✅ Mudança que afeta múltiplos arquivos
- ✅ Integração com novo serviço
- ✅ Qualquer mudança que leve mais de 1 hora

---

## Processo de Planejamento

### Passo 1: Coleta Inicial de Contexto

Se nenhum contexto foi fornecido, responda:

```
Vou ajudar a criar um plano de implementação para o Opina Já!

Por favor, forneça:

1. **O que precisa ser feito?**
   (Descrição da feature/mudança)

2. **Por que é necessário?**
   (Problema que resolve ou valor que agrega)

3. **Contexto adicional:**
   - Arquivos que você sabe que serão afetados
   - Restrições ou limitações conhecidas
   - Prazo ou prioridade

4. **Referências:**
   - Link para issue/ticket (se houver)
   - Documentação relacionada
   - Exemplos de como deve funcionar

💡 Dica: Quanto mais contexto você fornecer, melhor será o plano.
```

**Aguarde a resposta do usuário antes de continuar.**

---

### Passo 2: Leitura e Pesquisa

Após receber o contexto:

```
⚠️ REGRAS DE LEITURA:
- Leia TODOS os arquivos mencionados COMPLETAMENTE
- NUNCA use limit/offset
- Leia ANTES de fazer qualquer análise
- Pesquise padrões existentes no código
```

**Ordem de pesquisa**:

1. Arquivos diretamente mencionados pelo usuário
2. `prisma/schema.prisma` - entender modelos existentes
3. Arquivos similares ao que será criado
4. Padrões de código utilizados no projeto

---

### Passo 3: Apresentar Entendimento

Após pesquisar, apresente seu entendimento:

```
## 🎯 Meu Entendimento

Baseado na minha análise do código e no que você descreveu:

**O que vamos fazer:**
[Resumo em 2-3 frases]

**O que encontrei no código:**
- `arquivo.ts:linha` - [descoberta relevante]
- `outro-arquivo.ts:linha` - [padrão a seguir]
- [Complexidade ou edge case identificado]

**Perguntas que preciso esclarecer:**
1. [Pergunta técnica que requer decisão humana]
2. [Clarificação de regra de negócio]

⚠️ Só faço perguntas que NÃO consegui responder investigando o código.

---

Meu entendimento está correto? Pode responder as perguntas acima?
```

**Aguarde confirmação antes de continuar.**

---

### Passo 4: Propor Estrutura do Plano

Após alinhar entendimento:

```
## 📐 Estrutura Proposta

### Overview
[1-2 frases resumindo a implementação]

### Fases de Implementação

**Fase 1: [Nome]** (~X horas)
└── [O que será feito e resultado esperado]

**Fase 2: [Nome]** (~X horas)
└── [O que será feito e resultado esperado]

**Fase 3: [Nome]** (~X horas)
└── [O que será feito e resultado esperado]

### Estimativa Total: ~X horas

---

Essa estrutura de fases faz sentido?
Devo ajustar a ordem ou granularidade?
```

**Aguarde aprovação da estrutura antes de detalhar.**

---

### Passo 5: Escrever Plano Detalhado

Após aprovação da estrutura, crie o plano completo.

**Arquivo**: `docs/plans/YYYY-MM-DD-[descricao-kebab-case].md`

```markdown
---
data: [Data atual ISO]
autor: Claude + [Nome do usuário]
status: aprovado
ticket: [Link se houver]
estimativa: [X horas]
tags: [feature/update/fix, módulos-afetados]
---

# [Nome da Feature/Mudança] - Plano de Implementação

## Overview

[Descrição clara do que será implementado e o valor que entrega]

## Estado Atual

### Como funciona hoje
[Descrição do comportamento atual com referências de código]

### Limitações/Problemas
[O que motiva essa mudança]

### Código relevante
| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/...` | X-Y | [O que faz] |

## Estado Desejado

### Como deve funcionar
[Especificação clara do resultado final]

### Critérios de aceitação
- [ ] [Critério mensurável 1]
- [ ] [Critério mensurável 2]
- [ ] [Critério mensurável 3]

### Como verificar
[Passos para confirmar que está funcionando]

## O Que NÃO Estamos Fazendo

> ⚠️ Importante: Estes itens estão FORA do escopo deste plano

- [Item explicitamente fora do escopo 1]
- [Item explicitamente fora do escopo 2]
- [Item que pode parecer relacionado mas não será feito]

## Abordagem Técnica

[Explicação de alto nível da estratégia escolhida e por quê]

---

# Fases de Implementação

---

## Fase 1: [Nome Descritivo]

### Objetivo
[O que esta fase realiza - resultado tangível]

### Arquivos a Modificar/Criar

#### 1. [Nome do arquivo ou componente]

**Arquivo**: `src/caminho/arquivo.ts`
**Ação**: [Criar | Modificar | Deletar]

**Mudanças**:
[Descrição das mudanças necessárias]

```typescript
// Código específico a ser adicionado/modificado
// Com comentários explicando partes importantes
```

#### 2. [Próximo arquivo]

**Arquivo**: `src/caminho/outro-arquivo.ts`
**Ação**: [Criar | Modificar | Deletar]

**Mudanças**:
[Descrição das mudanças]

```typescript
// Código
```

### Migrações de Banco (se aplicável)

```prisma
// Mudanças no schema.prisma
model NomeDoModelo {
  // campos
}
```

```bash
# Comando para aplicar
npx prisma migrate dev --name nome-da-migracao
```

### Critérios de Sucesso - Fase 1

#### ✅ Verificação Automatizada
- [ ] Prisma válido: `npx prisma validate`
- [ ] TypeScript compila: `npm run build`
- [ ] Lint passa: `npm run lint`
- [ ] Testes passam: `npm test`
- [ ] Migração aplica: `npx prisma migrate dev`

#### 👁️ Verificação Manual
- [ ] [Teste manual específico 1]
- [ ] [Teste manual específico 2]
- [ ] [Verificação visual/funcional]

---

**⏸️ PAUSE AQUI**

> Após completar a verificação automatizada, PARE e informe:
>
> ```
> ✅ Fase 1 Completa - Pronto para Verificação Manual
>
> Verificação automatizada passou:
> - [Lista do que passou]
>
> Por favor, execute os testes manuais:
> - [Lista dos testes manuais]
>
> Me avise quando concluir para prosseguir à Fase 2.
> ```

---

## Fase 2: [Nome Descritivo]

### Objetivo
[O que esta fase realiza]

### Arquivos a Modificar/Criar

[Mesma estrutura da Fase 1...]

### Critérios de Sucesso - Fase 2

#### ✅ Verificação Automatizada
- [ ] [Checks automatizados]

#### 👁️ Verificação Manual
- [ ] [Testes manuais]

---

**⏸️ PAUSE AQUI**

[Mesmo padrão de pausa...]

---

## Fase 3: [Nome Descritivo]

[Mesma estrutura...]

---

# Estratégia de Testes

## Testes Unitários

### Novos testes a criar
| Arquivo de Teste | O que testa |
|------------------|-------------|
| `__tests__/review.test.ts` | [Descrição] |

### Casos de teste
- [ ] [Caso de sucesso principal]
- [ ] [Edge case 1]
- [ ] [Edge case 2]
- [ ] [Caso de erro esperado]

## Testes de Integração

- [ ] [Cenário E2E 1]
- [ ] [Cenário E2E 2]

## Testes Manuais

### Fluxo principal
1. [Passo 1 com resultado esperado]
2. [Passo 2 com resultado esperado]
3. [Passo 3 com resultado esperado]

### Edge cases a testar manualmente
1. [Cenário edge case]
2. [Outro cenário]

---

# Considerações

## Performance
[Implicações de performance e otimizações planejadas]

## Segurança
[Considerações de segurança, se aplicável]

## Rollback
[Como reverter se algo der errado]

## Monitoramento
[O que monitorar após deploy]

---

# Referências

- **Ticket/Issue**: [Link]
- **Pesquisa relacionada**: `docs/research/YYYY-MM-DD-topico.md`
- **Documentação**: [Links relevantes]
- **Código similar**: `src/path/to/similar.ts`

---

# Changelog do Plano

| Data | Autor | Mudança |
|------|-------|---------|
| YYYY-MM-DD | [Nome] | Criação inicial |
```

---

### Passo 6: Apresentar e Iterar

Após criar o plano:

```
## 📄 Plano Criado

Salvei o plano em: `docs/plans/YYYY-MM-DD-[descricao].md`

### Resumo
- **Fases**: [N] fases
- **Estimativa**: ~[X] horas
- **Arquivos afetados**: [N] arquivos

### Estrutura
1. Fase 1: [Nome] - [objetivo]
2. Fase 2: [Nome] - [objetivo]
3. Fase 3: [Nome] - [objetivo]

---

Por favor, revise o plano e me diga:
- As fases estão bem dimensionadas?
- Os critérios de sucesso são específicos o suficiente?
- Falta algum edge case ou consideração?
- Algum detalhe técnico precisa de ajuste?
```

**Itere até aprovação final.**

---

## Padrões Comuns no Opina Já!

### Para Mudanças de Banco de Dados
1. Schema Prisma → 2. Migração → 3. Service → 4. API → 5. UI

### Para Novas Features
1. Modelo de dados → 2. Backend/API → 3. Frontend → 4. Testes

### Para Integrações
1. Lib/Client → 2. Service → 3. Webhook (se necessário) → 4. UI

### Para Refatorações
1. Documentar estado atual → 2. Criar abstração → 3. Migrar gradualmente → 4. Remover código antigo

---

## Checklist de Qualidade do Plano

Antes de finalizar, verifique:

- [ ] Li todos os arquivos relevantes COMPLETAMENTE
- [ ] Validei entendimento com o usuário
- [ ] Estrutura de fases foi aprovada
- [ ] Cada fase tem objetivo claro e mensurável
- [ ] Critérios de sucesso separados (automatizado vs manual)
- [ ] "O que NÃO estamos fazendo" está definido
- [ ] Código de exemplo está incluído onde necessário
- [ ] Considerações de rollback documentadas
- [ ] ZERO perguntas em aberto no plano final
- [ ] Plano salvo em `docs/plans/`

---

## Comandos Úteis

```bash
# Validação Prisma
npx prisma validate
npx prisma format

# Migrações
npx prisma migrate dev --name nome
npx prisma migrate reset  # CUIDADO: apaga dados

# Build e Lint
npm run build
npm run lint
npm run lint:fix

# Testes
npm test
npm run test:watch
npm run test:coverage

# Desenvolvimento
npm run dev
```
