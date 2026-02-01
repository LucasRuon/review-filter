---
date: 2026-02-01T00:00:00Z
researcher: Claude
git_commit: 6b24e94
branch: main
repository: review-filter
topic: "Client limit error message shows 'Request error' instead of correct message"
tags: [research, codebase, error-handling, api, frontend]
status: complete
---

# Pesquisa: Client limit error message shows 'Request error' instead of correct message

**Data**: 2026-02-01
**Branch**: main
**Commit**: 6b24e94

## Pergunta de Pesquisa

This error occurs when attempting to add more clients than the user's current plan limit. Currently, it returns "Request error". The correct message should be "You have reached the limit of registered clients".

## Resumo

O problema ocorre porque o **frontend** (`public/js/app.js`) nao trata corretamente respostas HTTP 403. Quando o backend retorna 403 com a mensagem de limite atingido, o frontend intercepta e substitui por uma mensagem generica "Erro na requisicao".

**Fluxo atual:**
1. Usuario tenta criar cliente alem do limite
2. Backend retorna HTTP 403 com JSON: `{ error: true, code: 'PLAN_LIMIT_REACHED', message: 'Voce atingiu o limite de clients do seu plano' }`
3. Frontend em `api.post()` verifica `!res.ok && res.status !== 400` - como 403 !== 400, retorna `{ error: 'Erro na requisicao' }`
4. Toast exibe "Erro na requisicao" em vez da mensagem real

## Descobertas Detalhadas

### Backend - Middleware de Subscription

O middleware `checkPlanLimit` em `middleware/subscription.js:99-133` verifica corretamente o limite:

```javascript
function checkPlanLimit(limitKey) {
    return async (req, res, next) => {
        // ...
        const limitCheck = await db.checkUserLimit(req.userId, limitKey);

        if (!limitCheck.allowed) {
            return res.status(403).json({
                error: true,
                code: 'PLAN_LIMIT_REACHED',
                message: `Voce atingiu o limite de ${limitKey} do seu plano`,
                limit: {
                    type: limitKey,
                    current: limitCheck.current,
                    max: limitCheck.limit
                },
                upgrade_url: '/pricing'
            });
        }
        // ...
    };
}
```

A mensagem retornada seria: **"Voce atingiu o limite de clients do seu plano"**

### Backend - Rota de Criacao de Cliente

A rota POST `/api/clients` em `routes/clients.js:76` usa o middleware:

```javascript
router.post('/', authMiddleware, requireSubscription('any'), checkPlanLimit('clients'), async (req, res) => {
```

### Frontend - API Helper (PROBLEMA)

O problema esta em `public/js/app.js:21-36`:

```javascript
async post(url, data) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok && res.status !== 400) {
            return { error: 'Erro na requisicao' };  // <-- PROBLEMA: nao parseia JSON do 403
        }
        return res.json();
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Erro de conexao' };
    }
}
```

**Problema:** Quando `res.status === 403`, a condicao `!res.ok && res.status !== 400` e verdadeira, entao retorna o erro generico sem ler o JSON da resposta.

### Frontend - Submit do Formulario

Em `views/app.html:1783-1818`, a funcao `submitClientForm` usa o resultado:

```javascript
if (res.success) {
    showToast(clientId ? 'Cliente atualizado!' : 'Cliente criado!');
    setTimeout(() => navigateTo('/clients'), 500);
} else {
    showToast(res.error, 'error');  // <-- Exibe 'Erro na requisicao'
    // ...
}
```

## Referencias de Codigo

| Arquivo | Linha | Descricao |
|---------|-------|-----------|
| `middleware/subscription.js` | 99-133 | Middleware `checkPlanLimit` que verifica limite e retorna 403 |
| `middleware/subscription.js` | 111-112 | Codigo e mensagem de erro `PLAN_LIMIT_REACHED` |
| `routes/clients.js` | 76 | Rota POST que usa `checkPlanLimit('clients')` |
| `public/js/app.js` | 21-36 | Funcao `api.post()` que intercepta erro 403 |
| `public/js/app.js` | 28-29 | Condicao problematica que nao parseia JSON do 403 |
| `views/app.html` | 1807 | Chamada `api.post('/api/clients', data)` |
| `views/app.html` | 1814 | Exibicao do erro via `showToast(res.error, 'error')` |

## Padroes Arquiteturais

1. **Middleware Pattern**: O sistema usa middlewares encadeados para validacao (auth -> subscription -> planLimit -> handler)
2. **Centralized API Helper**: Todas as chamadas HTTP passam pelo objeto `api` em `app.js`
3. **Toast Notifications**: Erros sao exibidos via `showToast()` com tipo 'error'

## Solucao Necessaria

A correcao deve ser feita no frontend (`public/js/app.js`) nos metodos `post`, `put` e `delete` para:
1. Parsear o JSON mesmo em respostas de erro (400, 403, etc.)
2. Retornar a mensagem real do servidor em vez de mensagem generica
3. Tratar especificamente o codigo `PLAN_LIMIT_REACHED` se desejado

### Exemplo de correcao para `api.post`:

```javascript
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
                error: json.message || json.error || 'Erro na requisicao',
                code: json.code,
                ...json
            };
        }
        return json;
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Erro de conexao' };
    }
}
```

## Mensagem Sugerida

O usuario pediu a mensagem: **"You have reached the limit of registered clients"** (em ingles)

O backend atualmente retorna em portugues: **"Voce atingiu o limite de clients do seu plano"**

Se desejar a mensagem em portugues mais amigavel, alterar `middleware/subscription.js:112` para:
- **"Voce atingiu o limite de clientes cadastrados"**

Ou em ingles:
- **"You have reached the limit of registered clients"**

## Questoes em Aberto

1. Deve-se manter as mensagens em portugues ou ingles?
2. Deve-se mostrar informacoes adicionais (ex: "Atual: 5/5 clientes. Faca upgrade para adicionar mais.")?
3. Os metodos `put` e `delete` do `api` helper tambem precisam da mesma correcao
