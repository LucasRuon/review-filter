# 📚 Manual Completo: Sistema SDD para Opina Já!

## Specification-Driven Development (SDD)

---

## Índice

1. [O que é SDD?](#o-que-é-sdd)
2. [Visão Geral dos Templates](#visão-geral-dos-templates)
3. [Fluxo de Trabalho](#fluxo-de-trabalho)
4. [Guia de Cada Template](#guia-de-cada-template)
5. [Melhores Práticas](#melhores-práticas)
6. [Estrutura de Pastas](#estrutura-de-pastas)
7. [Integração com Claude Code](#integração-com-claude-code)
8. [Troubleshooting](#troubleshooting)
9. [Exemplos Práticos](#exemplos-práticos)

---

## O que é SDD?

**Specification-Driven Development** é uma metodologia onde:

1. **Você especifica** o que quer antes de codificar
2. **Claude pesquisa** o código existente
3. **Vocês planejam juntos** a implementação
4. **Claude implementa** seguindo o plano aprovado
5. **Você valida** cada fase

### Por que usar SDD?

| Sem SDD | Com SDD |
|---------|---------|
| "Faz uma feature de X" | Especificação clara do que X significa |
| Claude improvisa | Claude segue plano aprovado |
| Resultado imprevisível | Resultado alinhado com expectativa |
| Difícil retomar trabalho | Checkboxes mostram progresso |
| Bugs por mal-entendido | Validação em cada fase |

### Princípios Fundamentais

```
┌─────────────────────────────────────────────────────────────┐
│  1. ESPECIFICAR ANTES DE CODIFICAR                          │
│     → Defina o "o quê" antes do "como"                      │
│                                                             │
│  2. PESQUISAR ANTES DE PLANEJAR                             │
│     → Entenda o código existente                            │
│                                                             │
│  3. PLANEJAR ANTES DE IMPLEMENTAR                           │
│     → Divida em fases verificáveis                          │
│                                                             │
│  4. VALIDAR ANTES DE AVANÇAR                                │
│     → Cada fase precisa de OK humano                        │
│                                                             │
│  5. DOCUMENTAR SEMPRE                                       │
│     → Pesquisas, planos e bugs ficam registrados            │
└─────────────────────────────────────────────────────────────┘
```

---

## Visão Geral dos Templates

### Os 4 Templates

| # | Template | Comando | Quando Usar | Modelo Ideal |
|---|----------|---------|-------------|--------------|
| 1 | **Pesquisar** | `/pesquisar` | Entender código existente | Opus 4.5 |
| 2 | **Planejar** | `/planejar` | Criar plano de implementação | Opus 4.5 |
| 3 | **Implementar** | `/implementar` | Executar plano aprovado | Sonnet 4.5 |
| 4 | **Fix** | `/fix` | Corrigir bugs pontuais | Sonnet 4.5 |

### Diagrama de Decisão

```
                    ┌─────────────────┐
                    │  Nova Demanda   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Entendo o código │
                    │   dessa área?    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
            NÃO                            SIM
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  /pesquisar     │           │   É um bug?     │
    │  (Opus 4.5)     │           └────────┬────────┘
    └────────┬────────┘                    │
             │                   ┌─────────┴─────────┐
             │                   │                   │
             │                  SIM                 NÃO
             │                   │                   │
             │                   ▼                   ▼
             │         ┌─────────────────┐ ┌─────────────────┐
             │         │  Simples (<2h)? │ │  É complexo?    │
             │         └────────┬────────┘ └────────┬────────┘
             │                  │                   │
             │           ┌──────┴──────┐     ┌──────┴──────┐
             │           │             │     │             │
             │          SIM           NÃO   SIM           NÃO
             │           │             │     │             │
             │           ▼             │     ▼             │
             │  ┌─────────────────┐    │ ┌─────────────┐   │
             │  │  /fix           │    │ │ /planejar   │   │
             │  │  (Sonnet 4.5)   │    │ │ (Opus 4.5)  │   │
             │  └────────┬────────┘    │ └──────┬──────┘   │
             │           │             │        │          │
             │           │             └────────┤          │
             │           │                      ▼          │
             │           │             ┌─────────────────┐ │
             │           │             │ /implementar    │ │
             │           │             │ (Sonnet 4.5)    │ │
             │           │             └────────┬────────┘ │
             │           │                      │          │
             ▼           ▼                      ▼          ▼
        ┌─────────────────────────────────────────────────────┐
        │                     CONCLUÍDO                       │
        └─────────────────────────────────────────────────────┘
```

---

## Fluxo de Trabalho

### Fluxo Completo: Nova Feature

```
Dia 1: Descoberta
├── 1. Usuário descreve a necessidade
├── 2. /pesquisar [área relacionada]
│   └── Claude documenta código existente
└── 3. Documento salvo em docs/research/

Dia 1-2: Planejamento
├── 4. /planejar [feature]
├── 5. Claude faz perguntas de clarificação
├── 6. Claude propõe estrutura de fases
├── 7. Usuário aprova/ajusta estrutura
├── 8. Claude escreve plano detalhado
├── 9. Usuário revisa e aprova plano
└── 10. Plano salvo em docs/plans/

Dia 2+: Implementação
├── 11. /implementar docs/plans/[plano].md
├── 12. Claude executa Fase 1
│   ├── Implementa código
│   ├── Roda verificação automatizada
│   └── Solicita verificação manual
├── 13. Usuário confirma Fase 1 OK
├── 14. Claude executa Fase 2
│   └── [Mesmo processo...]
├── 15. [Repete para todas as fases]
└── 16. Claude apresenta resumo final

Pós-implementação:
├── 17. Deploy para staging
├── 18. Testes de aceitação
└── 19. Deploy para produção
```

### Fluxo Simplificado: Bug Fix

```
1. Usuário reporta bug
      │
      ▼
2. /fix [descrição]
      │
      ▼
3. Claude investiga
   ├── Lê arquivos
   ├── Identifica causa
   └── Propõe solução
      │
      ▼
4. Usuário aprova solução
      │
      ▼
5. Claude implementa fix
      │
      ▼
6. Verificação automática
      │
      ▼
7. Usuário confirma fix OK
      │
      ▼
8. Documentado em docs/bugs/
```

---

## Guia de Cada Template

### 1. `/pesquisar` - Template de Pesquisa

**Propósito**: Documentar código existente SEM sugerir mudanças.

**Quando usar**:
- Antes de trabalhar em área desconhecida
- Para criar documentação técnica
- Para onboarding em módulo específico
- Antes de planejar feature complexa

**Como usar**:

```
Você: /pesquisar módulo de WhatsApp

Claude: [Lê todos os arquivos relacionados]
        [Mapeia estrutura]
        [Documenta fluxos]
        [Identifica padrões]
        [Salva em docs/research/]
```

**O que esperar**:
- Árvore de arquivos relevantes
- Diagramas de fluxo de dados
- Tabelas de dependências
- Referências arquivo:linha
- Documento salvo para consulta futura

**Modelo recomendado**: Opus 4.5 (melhor para análise profunda)

---

### 2. `/planejar` - Template de Planejamento

**Propósito**: Criar plano detalhado de implementação de forma interativa.

**Quando usar**:
- Nova feature a desenvolver
- Refatoração significativa
- Mudança que afeta múltiplos arquivos
- Qualquer trabalho > 1 hora

**Como usar**:

```
Você: /planejar integração com Google Reviews API

Claude: [Faz perguntas de clarificação]

Você: [Responde perguntas]

Claude: [Apresenta entendimento]
        "Meu entendimento está correto?"

Você: Sim, mas também precisa de X

Claude: [Propõe estrutura de fases]
        "Essa estrutura faz sentido?"

Você: Sim, pode detalhar

Claude: [Escreve plano completo]
        [Salva em docs/plans/]
        "Revise e me diga se precisa ajustar algo"
```

**O que esperar**:
- Processo interativo (não escreve tudo de uma vez)
- Validação em cada etapa
- Plano com fases incrementais
- Critérios de sucesso (automatizado + manual)
- Definição clara do que NÃO está no escopo

**Modelo recomendado**: Opus 4.5 (melhor para planejamento e arquitetura)

---

### 3. `/implementar` - Template de Implementação

**Propósito**: Executar plano aprovado com verificação fase a fase.

**Quando usar**:
- Após ter plano aprovado em `docs/plans/`
- Quando estiver pronto para codificar

**Como usar**:

```
Você: /implementar docs/plans/2024-01-15-google-reviews.md

Claude: [Lê plano completo]
        [Lê todos os arquivos mencionados]
        "Iniciando Fase 1..."
        [Implementa]
        [Roda verificação automatizada]
        "Fase 1 completa. Por favor, teste manualmente:
         - [item 1]
         - [item 2]
         Confirme quando estiver OK."

Você: OK, testei e está funcionando

Claude: "Iniciando Fase 2..."
        [Repete processo]
```

**O que esperar**:
- Execução metódica do plano
- Pausa entre fases para validação
- Atualização de checkboxes no plano
- Comunicação clara se algo não bater
- Resumo final ao concluir

**Modelo recomendado**: Sonnet 4.5 (rápido para execução)

---

### 4. `/fix` - Template de Correção de Bug

**Propósito**: Corrigir bugs de forma rápida e documentada.

**Quando usar**:
- Bug identificado
- Problema pontual
- Estimativa < 2-3 horas
- Causa raiz localizável

**Como usar**:

```
Você: /fix Reviews não estão sendo salvos quando rating é 5

Claude: "Para corrigir, preciso de mais detalhes:
         1. Passos para reproduzir?
         2. Mensagem de erro?
         3. Quando começou?"

Você: [Fornece detalhes]

Claude: [Investiga]
        "Encontrei a causa: [explicação]
         Solução proposta: [código]
         Posso prosseguir?"

Você: Sim

Claude: [Implementa]
        [Verifica]
        "Por favor, teste se o bug foi corrigido"

Você: Funcionou!

Claude: [Documenta em docs/bugs/]
        "Bug corrigido e documentado!"
```

**O que esperar**:
- Coleta de informações do bug
- Investigação da causa raiz
- Proposta de solução antes de implementar
- Verificação automatizada + manual
- Documentação do fix

**Modelo recomendado**: Sonnet 4.5 (rápido para fixes)

---

## Melhores Práticas

### ✅ FAÇA

```
✅ Forneça contexto completo nas solicitações
✅ Responda as perguntas de clarificação
✅ Valide o entendimento do Claude antes de prosseguir
✅ Teste manualmente quando solicitado
✅ Confirme explicitamente (OK, Passou, etc.)
✅ Reporte problemas encontrados durante teste
✅ Mantenha a estrutura de docs/ organizada
```

### ❌ EVITE

```
❌ Pedidos vagos ("melhora isso")
❌ Pular a fase de pesquisa em áreas desconhecidas
❌ Aprovar planos sem revisar
❌ Ignorar solicitações de verificação manual
❌ Pedir para Claude "continuar" sem confirmar fase anterior
❌ Implementar sem plano para mudanças complexas
❌ Misturar múltiplas features em um único plano
```

### Comunicação Efetiva com Claude

**Bom**:
```
"Preciso adicionar filtro por data na listagem de reviews.
O usuário deve poder selecionar data inicial e final.
Deve filtrar no backend, não no frontend.
Relacionado ao arquivo src/app/reviews/page.tsx"
```

**Ruim**:
```
"Adiciona filtro nos reviews"
```

### Quando Interromper e Recomeçar

Se Claude estiver:
- Indo na direção errada → Corrija imediatamente
- Não entendendo o requisito → Reformule com mais contexto
- Fazendo muitas suposições → Forneça informações faltantes

```
"Para. Deixa eu explicar melhor: [nova explicação]"
```

---

## Estrutura de Pastas

```
opina-ja/
├── docs/
│   ├── research/           # Pesquisas de código
│   │   ├── 2024-01-10-modulo-whatsapp.md
│   │   ├── 2024-01-12-fluxo-reviews.md
│   │   └── ...
│   │
│   ├── plans/              # Planos de implementação
│   │   ├── 2024-01-15-google-reviews-integration.md
│   │   ├── 2024-01-20-dashboard-analytics.md
│   │   └── ...
│   │
│   ├── bugs/               # Documentação de bugs corrigidos
│   │   ├── 2024-01-18-rating-null-error.md
│   │   └── ...
│   │
│   └── templates/          # Templates SDD (este manual)
│       ├── 01-PESQUISAR.md
│       ├── 02-PLANEJAR.md
│       ├── 03-IMPLEMENTAR.md
│       ├── 04-FIX.md
│       └── 00-MANUAL.md
│
├── src/                    # Código fonte
├── prisma/                 # Schema do banco
├── __tests__/              # Testes
└── ...
```

### Convenção de Nomes

```
docs/research/YYYY-MM-DD-[topico-kebab-case].md
docs/plans/YYYY-MM-DD-[feature-kebab-case].md
docs/bugs/YYYY-MM-DD-[bug-descricao-kebab-case].md
```

---

## Integração com Claude Code

### Configuração Inicial

1. **Copie os templates para seu projeto**:
```bash
mkdir -p docs/templates
# Copie os 4 templates + manual para docs/templates/
```

2. **Configure como comandos do Claude Code** (opcional):
```bash
mkdir -p .claude/commands
# Crie arquivos de comando apontando para os templates
```

### Usando os Templates

**Opção 1: Referência direta**
```
Você: Siga o template em docs/templates/01-PESQUISAR.md 
      para pesquisar o módulo de pagamentos
```

**Opção 2: Comandos customizados**
Se configurou comandos:
```
Você: /pesquisar módulo de pagamentos
```

**Opção 3: Copiar e colar**
```
Você: [Cola o conteúdo do template relevante]
      Agora, pesquise o módulo de pagamentos
```

### Modelo por Template

Configure no Claude Code:
- **Opus 4.5** para: `/pesquisar`, `/planejar`
- **Sonnet 4.5** para: `/implementar`, `/fix`

---

## Troubleshooting

### Problema: Claude não está seguindo o template

**Solução**: Seja explícito
```
"Siga EXATAMENTE o processo do template. 
Estamos no Passo 2. Complete-o antes de avançar."
```

### Problema: Claude está improvisando demais

**Solução**: Reforce as regras
```
"Não improvise. Siga o plano aprovado.
Se algo não bater, PARE e me pergunte."
```

### Problema: Fases muito longas

**Solução**: Peça para dividir
```
"Essa fase está muito grande. 
Divida em sub-fases menores de ~30 minutos cada."
```

### Problema: Verificação manual ignorada

**Solução**: Exija a pausa
```
"Não prossiga para a próxima fase.
Aguarde minha confirmação dos testes manuais."
```

### Problema: Plano desatualizado

**Solução**: Atualize antes de implementar
```
"O código mudou desde o plano. 
Faça /pesquisar na área afetada e atualize o plano."
```

---

## Exemplos Práticos

### Exemplo 1: Nova Feature Completa

```
=== DIA 1: DESCOBERTA ===

Você: Quero adicionar integração com Google Reviews no Opina Já.
      Primeiro, pesquise como estão estruturadas nossas integrações atuais.

Claude: [Executa /pesquisar]
        [Documenta estrutura de integrações]
        [Salva em docs/research/2024-01-15-integracoes.md]

=== DIA 1-2: PLANEJAMENTO ===

Você: Agora vamos planejar a integração com Google Reviews.
      Preciso que:
      - Sincronize reviews do Google para nosso sistema
      - Permita responder reviews pelo nosso dashboard
      - Atualize a cada 1 hora automaticamente

Claude: [Executa /planejar]
        [Faz perguntas de clarificação]
        
Você: [Responde perguntas]

Claude: [Propõe estrutura de 4 fases]

Você: Aprovo a estrutura. Detalhe o plano.

Claude: [Escreve plano completo]
        [Salva em docs/plans/2024-01-15-google-reviews.md]

Você: [Revisa] 
      Ajuste a Fase 2 para incluir tratamento de rate limit.

Claude: [Ajusta plano]

Você: Aprovado!

=== DIA 2+: IMPLEMENTAÇÃO ===

Você: /implementar docs/plans/2024-01-15-google-reviews.md

Claude: [Executa Fase 1]
        [Verificação automatizada OK]
        "Por favor, teste: [lista de testes manuais]"

Você: Testei, está OK. Pode continuar.

Claude: [Executa Fase 2]
        ...
        
[Continua até concluir todas as fases]

Claude: "🎉 Implementação concluída! [Resumo]"
```

### Exemplo 2: Bug Fix Rápido

```
Você: /fix O botão de enviar review não funciona no mobile

Claude: "Preciso de mais detalhes:
         1. Qual navegador/dispositivo?
         2. Aparece algum erro?
         3. O que acontece quando clica?"

Você: iPhone Safari. Não aparece erro, simplesmente não acontece nada.
      Funciona no desktop.

Claude: [Investiga]
        "Encontrei o problema:
         Arquivo: src/components/ReviewForm.tsx:45
         Causa: Evento onClick não funciona bem em iOS
         Solução: Trocar para onTouchEnd com fallback
         
         Posso corrigir?"

Você: Sim, pode corrigir.

Claude: [Implementa]
        [Testes passam]
        "Corrigi. Por favor, teste no iPhone."

Você: Funcionou!

Claude: [Documenta em docs/bugs/]
        "Bug corrigido e documentado!"
```

---

## Checklist Rápido

### Antes de Começar Qualquer Trabalho

```
[ ] Sei qual template usar?
    → Não sei o código: /pesquisar
    → Feature/mudança complexa: /planejar → /implementar
    → Bug simples: /fix

[ ] Tenho contexto suficiente para passar ao Claude?
    → Descrição clara do que precisa
    → Arquivos relacionados (se souber)
    → Restrições ou limitações

[ ] Estou no modelo certo?
    → Opus 4.5: pesquisa, planejamento
    → Sonnet 4.5: implementação, fixes
```

### Durante o Trabalho

```
[ ] Estou validando cada etapa?
[ ] Estou testando manualmente quando solicitado?
[ ] Estou confirmando explicitamente (OK, Passou, etc.)?
[ ] Estou reportando problemas encontrados?
```

### Ao Finalizar

```
[ ] Documentação foi salva em docs/?
[ ] Plano foi atualizado com checkboxes?
[ ] Testes estão passando?
[ ] Funcionalidade foi validada manualmente?
```

---

## Conclusão

O sistema SDD transforma o desenvolvimento com Claude de "tentativa e erro" para "especificação e execução". 

**Lembre-se**:
1. **Especifique** → O que você quer
2. **Pesquise** → Entenda o código existente  
3. **Planeje** → Divida em fases verificáveis
4. **Implemente** → Execute o plano aprovado
5. **Valide** → Confirme cada fase

Com prática, esse fluxo se torna natural e seus resultados com Claude serão muito mais consistentes e previsíveis.

---

**Versão**: 1.0
**Data**: 2024
**Sistema**: Opina Já!
**Autor**: Claude + Lucas
