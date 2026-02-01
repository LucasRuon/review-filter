---
date: 2026-02-01T00:00:00Z
author: Claude
status: draft
ticket: N/A
research: docs/research/2026-02-01-client-limit-error-message.md
---

# Spec: Fix Client Limit Error Message Display

**Data**: 2026-02-01
**Baseado em**: docs/research/2026-02-01-client-limit-error-message.md
**Estimativa**: Pequena

## Objetivo

Corrigir o tratamento de erros HTTP no frontend para que mensagens de erro do servidor (como limite de plano atingido) sejam exibidas corretamente ao usuário, em vez da mensagem genérica "Erro na requisição".

## Escopo

### Incluído
- Correção do método `api.post()` em `public/js/app.js`
- Correção do método `api.put()` em `public/js/app.js`
- Correção do método `api.delete()` em `public/js/app.js`
- Melhorar mensagem no backend para ser mais amigável

### Não Incluído
- Criação de modal específico para upgrade de plano
- Alteração de outros middlewares
- Internacionalização (i18n)

## Pré-requisitos

- [x] Nenhum pré-requisito necessário

---

## Fases de Implementação

### Fase 1: Corrigir API Helper no Frontend

**Objetivo:** Modificar os métodos HTTP do objeto `api` para parsear corretamente respostas de erro e retornar a mensagem real do servidor.

#### Arquivos a Modificar:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `public/js/app.js` | Modificar | Corrigir métodos `post`, `put`, `delete` para parsear JSON em erros |

#### Detalhes de Implementação:

**1. `public/js/app.js` - Método `post` (linhas 21-36)**

Substituir o método atual:

```javascript
// ANTES (problemático)
async post(url, data) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok && res.status !== 400) {
            return { error: 'Erro na requisicao' };
        }
        return res.json();
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Erro de conexao' };
    }
}
```

Por:

```javascript
// DEPOIS (corrigido)
async post(url, data) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        // Sempre tentar parsear JSON para obter mensagem de erro real
        const json = await res.json();
        if (!res.ok) {
            return {
                error: json.message || json.error || 'Erro na requisição',
                code: json.code,
                ...json
            };
        }
        return json;
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Erro de conexão' };
    }
}
```

**2. `public/js/app.js` - Método `put`**

Localizar e aplicar a mesma correção ao método `put`:

```javascript
// DEPOIS (corrigido)
async put(url, data) {
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) {
            return {
                error: json.message || json.error || 'Erro na requisição',
                code: json.code,
                ...json
            };
        }
        return json;
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Erro de conexão' };
    }
}
```

**3. `public/js/app.js` - Método `delete`**

Localizar e aplicar a mesma correção ao método `delete`:

```javascript
// DEPOIS (corrigido)
async delete(url) {
    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        if (!res.ok) {
            return {
                error: json.message || json.error || 'Erro na requisição',
                code: json.code,
                ...json
            };
        }
        return json;
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Erro de conexão' };
    }
}
```

#### Critérios de Sucesso - Fase 1:

**Verificação Automatizada:**
- [x] Servidor inicia sem erros: `npm start`
- [x] Sem erros de sintaxe JavaScript no console do navegador

**Verificação Manual:**
- [ ] Criar cliente até atingir limite do plano
- [ ] Verificar que a mensagem exibida é a do servidor, não "Erro na requisição"
- [ ] Testar edição de cliente (PUT) com erro para verificar mensagem
- [ ] Testar exclusão de cliente (DELETE) com erro para verificar mensagem

---

### Fase 2: Melhorar Mensagem do Backend (Opcional)

**Objetivo:** Tornar a mensagem de erro mais amigável e informativa.

#### Arquivos a Modificar:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `middleware/subscription.js` | Modificar | Melhorar mensagem de limite atingido |

#### Detalhes de Implementação:

**1. `middleware/subscription.js` - Linha 111-112**

Localizar:

```javascript
return res.status(403).json({
    error: true,
    code: 'PLAN_LIMIT_REACHED',
    message: `Voce atingiu o limite de ${limitKey} do seu plano`,
```

Substituir por:

```javascript
const limitMessages = {
    clients: 'Você atingiu o limite de clientes cadastrados',
    reviews: 'Você atingiu o limite de avaliações',
    templates: 'Você atingiu o limite de templates'
};

return res.status(403).json({
    error: true,
    code: 'PLAN_LIMIT_REACHED',
    message: limitMessages[limitKey] || `Você atingiu o limite de ${limitKey} do seu plano`,
```

#### Critérios de Sucesso - Fase 2:

**Verificação Manual:**
- [ ] Mensagem exibida é "Você atingiu o limite de clientes cadastrados"
- [ ] Mensagem usa acentuação correta

---

## Arquivos Afetados (Resumo)

### Novos Arquivos:
- Nenhum

### Arquivos Modificados:
- `public/js/app.js` - Métodos `post`, `put`, `delete` do objeto `api`
- `middleware/subscription.js` - Mensagem de erro do `checkPlanLimit` (opcional)

---

## Variáveis de Ambiente

Nenhuma nova variável necessária.

---

## Considerações de Segurança

- [x] Não expõe informações sensíveis do servidor
- [x] Mantém validação de autenticação
- [x] Não altera lógica de autorização

---

## Edge Cases

| Cenário | Comportamento Esperado |
|---------|----------------------|
| Resposta do servidor não é JSON válido | Retorna "Erro de conexão" |
| Servidor retorna 403 sem campo `message` | Usa `json.error` ou fallback "Erro na requisição" |
| Servidor retorna 403 com `message` vazio | Usa fallback "Erro na requisição" |
| Servidor offline | Retorna "Erro de conexão" |
| Timeout de rede | Retorna "Erro de conexão" |

---

## Rollback

Em caso de problemas:
1. Reverter código via git: `git checkout -- public/js/app.js middleware/subscription.js`

---

## Checklist Final

- [ ] Fase 1 implementada (correção do frontend)
- [ ] Fase 2 implementada (melhoria da mensagem - opcional)
- [ ] Servidor inicia sem erros
- [ ] Testes manuais passando
- [ ] Mensagem de limite de clientes exibida corretamente
