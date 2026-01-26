---
description: Pesquisar e documentar código existente no Opina Já!
model: opus
comando: /pesquisar [área ou dúvida]
---

# 🔍 Template: Pesquisa de Código

## Contexto do Projeto

```yaml
Sistema: Opina Já! - SaaS de gestão de reviews
Stack: Next.js 14, Node.js, Prisma, PostgreSQL
Integrações: WhatsApp, OpenAI (sentimento), Google Reviews
```

---

## REGRA FUNDAMENTAL

> **Documente APENAS o que existe. NÃO sugira melhorias, NÃO critique, NÃO proponha mudanças.**
> 
> Você é um cartógrafo criando um mapa técnico do sistema.

---

## Quando Usar Este Template

- ✅ Precisa entender como uma funcionalidade funciona
- ✅ Vai trabalhar em área desconhecida do código
- ✅ Quer mapear dependências e conexões
- ✅ Precisa documentar antes de planejar mudanças
- ✅ Onboarding em módulo específico

---

## Processo de Pesquisa

### Passo 1: Receber a Solicitação

Se nenhuma área específica foi mencionada, pergunte:

```
Vou pesquisar o código do Opina Já! para você.

O que você quer entender?
1. Uma funcionalidade específica (ex: "como funciona a análise de sentimento")
2. Um módulo inteiro (ex: "módulo de WhatsApp")
3. Um fluxo completo (ex: "fluxo do review desde criação até notificação")
4. Uma integração (ex: "como conectamos com Google Reviews")

Me diga a área ou sua dúvida específica.
```

---

### Passo 2: Leitura Completa dos Arquivos

**CRÍTICO**: Leia TODOS os arquivos relevantes COMPLETAMENTE.

```
⚠️ REGRAS DE LEITURA:
- NUNCA use limit/offset
- Leia o arquivo INTEIRO
- Leia ANTES de analisar ou responder
- Se o arquivo for grande, ainda assim leia tudo
```

**Ordem de leitura recomendada**:

1. Schema do Prisma (`prisma/schema.prisma`) - entender modelos
2. Rotas da API (`src/app/api/[área]/`) - entender endpoints
3. Services (`src/services/[área].service.ts`) - entender lógica
4. Components (`src/components/[área]/`) - entender UI
5. Utils/Helpers (`src/lib/`, `src/utils/`) - entender utilitários

---

### Passo 3: Mapear Estrutura

Documente a estrutura encontrada:

```
## Estrutura: [Área Pesquisada]

### Arquivos Principais
├── src/
│   ├── app/
│   │   └── api/
│   │       └── reviews/
│   │           ├── route.ts ........... [Endpoint principal - CRUD]
│   │           └── [id]/
│   │               └── route.ts ....... [Operações por ID]
│   ├── services/
│   │   └── review.service.ts .......... [Lógica de negócio]
│   ├── lib/
│   │   └── openai.ts .................. [Cliente OpenAI]
│   └── components/
│       └── reviews/
│           ├── ReviewCard.tsx ......... [Card de exibição]
│           └── ReviewForm.tsx ......... [Formulário]
└── prisma/
    └── schema.prisma .................. [Modelo Review: linha 45-67]
```

---

### Passo 4: Documentar Fluxo de Dados

```
## Fluxo: [Nome do Fluxo]

┌─────────────┐
│  Entrada    │  [Descreva o trigger/input]
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  1. [Arquivo:linha]                 │
│     [O que acontece neste passo]    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  2. [Arquivo:linha]                 │
│     [O que acontece neste passo]    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Saída     │  [Descreva o output]
└─────────────┘
```

---

### Passo 5: Documentar Conexões e Dependências

```
## Conexões

### Dependências Internas
| Arquivo | Depende de | Tipo |
|---------|-----------|------|
| `review.service.ts` | `prisma/client` | Database |
| `review.service.ts` | `openai.ts` | Integração |
| `ReviewCard.tsx` | `review.service.ts` | Service |

### Dependências Externas
| Pacote | Usado em | Propósito |
|--------|----------|-----------|
| `openai` | `src/lib/openai.ts` | Análise de sentimento |
| `@prisma/client` | `src/services/*` | ORM |
| `axios` | `src/lib/whatsapp.ts` | HTTP client |

### Integrações
| Serviço | Arquivo | Credenciais |
|---------|---------|-------------|
| OpenAI | `src/lib/openai.ts:15` | `OPENAI_API_KEY` |
| WhatsApp | `src/lib/whatsapp.ts:8` | `WHATSAPP_TOKEN` |
```

---

### Passo 6: Documentar Padrões Encontrados

```
## Padrões Utilizados

### Padrão de Services
Localização: `src/services/*.service.ts`
```typescript
// Exemplo encontrado em review.service.ts:10-25
export class ReviewService {
  async create(data: CreateReviewDTO) {
    // validação
    // processamento
    // persistência
  }
}
```

### Padrão de API Routes
Localização: `src/app/api/*/route.ts`
```typescript
// Exemplo encontrado em reviews/route.ts:5-20
export async function POST(request: Request) {
  try {
    const body = await request.json()
    // validação com zod
    // chamada ao service
    // retorno padronizado
  } catch (error) {
    // tratamento de erro padrão
  }
}
```

### Padrão de Tratamento de Erros
[Descreva como erros são tratados no projeto]

### Padrão de Validação
[Descreva como validações são feitas - Zod, manual, etc.]
```

---

### Passo 7: Gerar Documento Final

Salve em: `docs/research/YYYY-MM-DD-[topico].md`

```markdown
---
data: [Data e hora atual ISO]
pesquisador: Claude
topico: "[Área pesquisada]"
tags: [research, nome-do-modulo]
status: completo
---

# Pesquisa: [Área/Tópico]

**Data**: [YYYY-MM-DD HH:mm]
**Commit**: [Se disponível]

## Pergunta de Pesquisa
[A dúvida ou área original solicitada]

## Resumo
[2-3 parágrafos explicando o que foi encontrado]

## Estrutura de Arquivos
[Árvore de arquivos relevantes]

## Fluxo de Dados
[Diagrama do fluxo]

## Referências de Código
| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/services/review.service.ts` | 45-67 | Lógica de análise |
| `src/app/api/reviews/route.ts` | 10-35 | Endpoint POST |

## Padrões Identificados
[Lista de padrões com exemplos]

## Conexões e Dependências
[Tabelas de dependências]

## Perguntas em Aberto
[Áreas que precisam de mais investigação]
```

---

## Apresentação ao Usuário

Após completar a pesquisa, apresente:

```
## 📋 Pesquisa Concluída: [Área]

### Resumo Executivo
[1-2 parágrafos do que foi encontrado]

### Arquivos Principais
- `arquivo1.ts:linha` - [descrição curta]
- `arquivo2.ts:linha` - [descrição curta]

### Fluxo Resumido
[Diagrama simplificado]

### Documento Completo
Salvo em: `docs/research/YYYY-MM-DD-[topico].md`

---

Tem alguma área específica que quer que eu aprofunde?
```

---

## Checklist de Qualidade

Antes de finalizar, verifique:

- [ ] Li TODOS os arquivos completamente (sem limit/offset)
- [ ] Documentei APENAS o que existe (sem sugestões)
- [ ] Incluí referências específicas (arquivo:linha)
- [ ] Mapeei todas as conexões e dependências
- [ ] Identifiquei padrões utilizados
- [ ] Criei diagrama de fluxo
- [ ] Salvei documento em `docs/research/`
- [ ] Apresentei resumo executivo ao usuário
