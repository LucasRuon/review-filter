# Otimização de Performance - Plano de Implementação

## Overview

Reduzir o tempo de carregamento das páginas após login de 3-5 segundos para menos de 1 segundo através de:
- Eliminação de chamadas API duplicadas
- Paralelização de requisições sequenciais
- Implementação de cache para dados frequentes
- Otimização do middleware de autenticação

## Estado Atual

| Página | Chamadas API | Queries DB | Tempo Estimado |
|--------|--------------|------------|----------------|
| Inicialização | 3 | 6 | ~1.5s |
| Dashboard | +1 | +3 | ~1s |
| Clients | +1 | +2 | ~0.8s |
| Complaints | +2 | +5 | ~1.5s |
| Integrations | +1 | +2 | ~0.8s |
| **Total Dashboard** | **4** | **9** | **~2.5s** |
| **Total Complaints** | **5** | **11** | **~3s** |

**Problemas identificados:**
- `views/app.html:157-160` - `/api/auth/me` chamado 2x na inicialização
- `views/app.html:156-172` - Chamadas sequenciais (checkAuth → loadUserInfo → loadSupportButton)
- `views/app.html:573-576` - Complaints busca clients antes de complaints (sequencial)
- `middleware/auth.js:41` - Query de verificação em cada request
- `views/app.html:146` - `pageCache` declarado mas não utilizado

## Estado Desejado

| Página | Chamadas API | Queries DB | Tempo Estimado |
|--------|--------------|------------|----------------|
| Inicialização | 1 | 2 | ~0.3s |
| Dashboard | +1 | +2 | ~0.3s |
| Clients | +1 | +1 | ~0.2s |
| Complaints | +1 | +2 | ~0.3s |
| **Total Dashboard** | **2** | **4** | **~0.6s** |
| **Total Complaints** | **2** | **4** | **~0.6s** |

## O Que NÃO Estamos Fazendo

- Reescrever o frontend para React/Vue
- Migrar para Next.js ou outro framework
- Alterar a estrutura do banco de dados
- Modificar a lógica de negócio das funcionalidades
- Implementar SSR (Server-Side Rendering)

---

## Fase 1: Eliminar Chamada Duplicada de `/api/auth/me`

### Objetivo
Remover a segunda chamada de `/api/auth/me` que ocorre em `loadUserInfo()`, reutilizando os dados já obtidos em `checkAuth()`.

### Mudanças

**Arquivo**: `views/app.html`

**Localização**: Linhas 156-172 (função `initApp`)

**Antes:**
```javascript
async function initApp() {
    const user = await checkAuth();
    if (!user) return;

    await loadUserInfo();
    loadUserAvatar();
    loadSupportButton();
    // ...
}
```

**Depois:**
```javascript
async function initApp() {
    const user = await checkAuth();
    if (!user) return;

    // Reutilizar dados do checkAuth em vez de chamar loadUserInfo
    updateUserUI(user);
    loadUserAvatar();
    loadSupportButton();
    // ...
}

// Nova função para atualizar UI com dados do usuário
function updateUserUI(user) {
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;

    // Salvar no localStorage para uso posterior
    const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || ''
    };
    localStorage.setItem('user', JSON.stringify(userData));
}
```

**Arquivo**: `public/js/app.js`

**Localização**: Linhas 109-125 (função `loadUserInfo`)

Manter a função mas ela não será mais chamada na inicialização. Pode ser usada para refresh manual.

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros: `npm start`
- [ ] Não há erros no console do navegador

**Verificação Manual:**
- [ ] Fazer login e verificar que nome/email aparecem no sidebar
- [ ] Abrir Network tab e confirmar que `/api/auth/me` é chamado apenas 1x
- [ ] Navegar entre páginas e verificar que dados do usuário persistem

**Redução esperada:** -1 chamada API, -2 queries DB (~0.3s)

---

## Fase 2: Paralelizar Chamadas de Inicialização

### Objetivo
Executar `loadSupportButton()` em paralelo com a navegação inicial, já que são independentes.

### Mudanças

**Arquivo**: `views/app.html`

**Localização**: Linhas 156-172 (função `initApp`)

**Antes:**
```javascript
async function initApp() {
    const user = await checkAuth();
    if (!user) return;

    updateUserUI(user);
    loadUserAvatar();
    loadSupportButton();      // Sequencial
    setupNavigation();

    const path = window.location.pathname;
    await navigateTo(path, false);  // Espera terminar

    hideLoading();
}
```

**Depois:**
```javascript
async function initApp() {
    const user = await checkAuth();
    if (!user) return;

    updateUserUI(user);
    loadUserAvatar();
    setupNavigation();

    const path = window.location.pathname;

    // Executar em paralelo: navegação + suporte
    await Promise.all([
        navigateTo(path, false),
        loadSupportButton()
    ]);

    hideLoading();
}
```

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros
- [ ] Não há erros no console do navegador

**Verificação Manual:**
- [ ] Fazer login e verificar que página carrega corretamente
- [ ] Verificar que botão de suporte WhatsApp aparece
- [ ] Medir tempo no Network tab (deve ser menor)

**Redução esperada:** ~0.2s (chamadas paralelas)

---

## Fase 3: Paralelizar Chamadas na Página de Complaints

### Objetivo
Buscar clientes e complaints em paralelo em vez de sequencialmente.

### Mudanças

**Arquivo**: `views/app.html`

**Localização**: Linhas 573-586 (função `loadAllComplaintsData`)

**Antes:**
```javascript
async function loadAllComplaintsData() {
    const clients = await api.get('/api/clients') || [];
    const response = await api.get('/api/complaints') || { complaints: [] };
    const complaints = response.complaints || [];

    // Popular filtro de clientes
    const clientFilter = document.getElementById('clientFilter');
    clientFilter.innerHTML = '<option value="">Todos os clientes</option>' +
        clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    window.allComplaints = complaints;
    window.allClients = clients;
    renderComplaints(complaints);
}
```

**Depois:**
```javascript
async function loadAllComplaintsData() {
    // Buscar em paralelo
    const [clients, response] = await Promise.all([
        api.get('/api/clients'),
        api.get('/api/complaints')
    ]);

    const clientsList = clients || [];
    const complaints = response?.complaints || [];

    // Popular filtro de clientes
    const clientFilter = document.getElementById('clientFilter');
    clientFilter.innerHTML = '<option value="">Todos os clientes</option>' +
        clientsList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    window.allComplaints = complaints;
    window.allClients = clientsList;
    renderComplaints(complaints);
}
```

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros
- [ ] Não há erros no console do navegador

**Verificação Manual:**
- [ ] Acessar página /complaints
- [ ] Verificar que filtro de clientes está populado
- [ ] Verificar que reclamações são exibidas
- [ ] Medir tempo no Network tab

**Redução esperada:** ~0.5s (chamadas paralelas em vez de sequenciais)

---

## Fase 4: Cache de Dados Frequentes no Backend

### Objetivo
Implementar cache para endpoints frequentes: `/api/auth/stats`, `/api/support-info`.

### Mudanças

**Arquivo**: `server.js`

**Localização**: Linhas 248-256 (rota `/api/support-info`)

**Antes:**
```javascript
app.get('/api/support-info', async (req, res) => {
    try {
        const whatsapp = await db.getPlatformSetting('support_whatsapp');
        const email = await db.getPlatformSetting('support_email');
        res.json({ whatsapp, email });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar informações' });
    }
});
```

**Depois:**
```javascript
app.get('/api/support-info', async (req, res) => {
    try {
        // Usar cache - TTL de 5 minutos
        const cacheKey = 'support_info';
        let supportInfo = cache.get(cacheKey);

        if (!supportInfo) {
            const whatsapp = await db.getPlatformSetting('support_whatsapp');
            const email = await db.getPlatformSetting('support_email');
            supportInfo = { whatsapp, email };
            cache.set(cacheKey, supportInfo, 300); // 5 minutos
        }

        res.json(supportInfo);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar informações' });
    }
});
```

**Arquivo**: `routes/auth.js`

**Localização**: Linhas 159-166 (rota `/stats`)

**Antes:**
```javascript
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await db.getStats(req.userId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});
```

**Depois:**
```javascript
const cache = require('../services/cache-service');

router.get('/stats', authMiddleware, async (req, res) => {
    try {
        // Cache por usuário - TTL de 30 segundos
        const cacheKey = `stats_${req.userId}`;
        let stats = cache.get(cacheKey);

        if (!stats) {
            stats = await db.getStats(req.userId);
            cache.set(cacheKey, stats, 30); // 30 segundos
        }

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});
```

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros: `npm start`
- [ ] Não há erros no console

**Verificação Manual:**
- [ ] Acessar Dashboard, recarregar 3x seguidas
- [ ] Verificar nos logs do servidor que queries diminuíram
- [ ] Criar uma reclamação e verificar que stats atualiza em até 30s

**Redução esperada:** ~0.3s em requests subsequentes

---

## Fase 5: Cache de Templates SPA no Frontend

### Objetivo
Utilizar o `pageCache` já declarado para evitar re-fetch de templates HTML.

### Mudanças

**Arquivo**: `views/app.html`

**Localização**: Linhas 278-286 (função `loadPageContent`)

**Antes:**
```javascript
async function loadPageContent(pageName, path) {
    // Buscar template da página
    const response = await fetch(`/spa/${pageName}`);
    if (!response.ok) throw new Error('Página não encontrada');

    let content = await response.text();

    return content;
}
```

**Depois:**
```javascript
async function loadPageContent(pageName, path) {
    // Verificar cache primeiro
    if (pageCache[pageName]) {
        return pageCache[pageName];
    }

    // Buscar template da página
    const response = await fetch(`/spa/${pageName}`);
    if (!response.ok) throw new Error('Página não encontrada');

    let content = await response.text();

    // Salvar no cache
    pageCache[pageName] = content;

    return content;
}
```

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Não há erros no console do navegador

**Verificação Manual:**
- [ ] Navegar: Dashboard → Clients → Dashboard
- [ ] Verificar no Network tab que `/spa/dashboard` não é chamado na segunda vez
- [ ] Verificar que conteúdo renderiza corretamente

**Redução esperada:** ~0.1s em navegações subsequentes

---

## Fase 6: Otimizar AuthMiddleware com Cache de Sessão

### Objetivo
Evitar query de verificação de usuário em cada request, usando cache de curta duração.

### Mudanças

**Arquivo**: `middleware/auth.js`

**Localização**: Linhas 27-56 (função `authMiddleware`)

**Antes:**
```javascript
async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Token nao fornecido' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token invalido' });
    }

    try {
        const user = await db.getUserByIdWithStatus(decoded.userId);
        if (!user) {
            res.clearCookie('token');
            return res.status(401).json({ error: 'Usuario nao encontrado' });
        }
        if (user.active === 0) {
            res.clearCookie('token');
            return res.status(403).json({ error: 'Sua conta esta desativada.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar usuario' });
    }

    req.userId = decoded.userId;
    next();
}
```

**Depois:**
```javascript
const cache = require('../services/cache-service');

async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Token nao fornecido' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token invalido' });
    }

    // Cache de verificação do usuário - TTL de 60 segundos
    const cacheKey = `auth_user_${decoded.userId}`;
    let user = cache.get(cacheKey);

    if (!user) {
        try {
            user = await db.getUserByIdWithStatus(decoded.userId);
            if (!user) {
                res.clearCookie('token');
                return res.status(401).json({ error: 'Usuario nao encontrado' });
            }
            if (user.active === 0) {
                res.clearCookie('token');
                return res.status(403).json({ error: 'Sua conta esta desativada.' });
            }
            // Cachear usuário válido
            cache.set(cacheKey, user, 60); // 60 segundos
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao verificar usuario' });
        }
    } else if (user.active === 0) {
        // Re-verificar do cache
        res.clearCookie('token');
        cache.delete(cacheKey);
        return res.status(403).json({ error: 'Sua conta esta desativada.' });
    }

    req.userId = decoded.userId;
    next();
}
```

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros
- [ ] `npm start` funciona

**Verificação Manual:**
- [ ] Fazer login e navegar entre páginas
- [ ] Verificar nos logs que queries de auth diminuíram
- [ ] Desativar usuário no admin e verificar que em até 60s ele é deslogado

**Redução esperada:** ~0.1s por request (elimina query de auth)

---

## Fase 7: Invalidação de Cache ao Modificar Dados

### Objetivo
Garantir que o cache seja invalidado quando dados são modificados.

### Mudanças

**Arquivo**: `routes/clients.js`

**Adicionar após criar/editar/deletar cliente:**

```javascript
const cache = require('../services/cache-service');

// No POST / (criar cliente) - após linha 88
cache.delete(`stats_${req.userId}`);

// No PUT /:id (editar cliente) - após linha 113
cache.delete(`stats_${req.userId}`);

// No DELETE /:id (deletar cliente) - após linha 130
cache.delete(`stats_${req.userId}`);
```

**Arquivo**: `routes/clients.js`

**Adicionar após atualizar status de complaint:**

```javascript
// No PUT /:clientId/complaints/:complaintId/status - após linha 173
cache.delete(`stats_${req.userId}`);
```

**Arquivo**: `server.js`

**Adicionar após criar complaint (rota /r/:slug):**

```javascript
// Buscar userId do cliente para invalidar cache
const client = await db.getClientBySlug(slug);
if (client) {
    cache.delete(`stats_${client.user_id}`);
}
```

### Critérios de Sucesso

**Verificação Automatizada:**
- [ ] Servidor inicia sem erros

**Verificação Manual:**
- [ ] Criar um cliente novo
- [ ] Verificar que Dashboard atualiza imediatamente (sem esperar TTL)
- [ ] Criar uma reclamação via link público
- [ ] Verificar que stats atualiza imediatamente

---

## Resumo das Reduções

| Fase | Otimização | Redução Estimada |
|------|------------|------------------|
| 1 | Eliminar `/api/auth/me` duplicado | -0.3s |
| 2 | Paralelizar inicialização | -0.2s |
| 3 | Paralelizar Complaints | -0.5s |
| 4 | Cache backend (stats, support) | -0.3s |
| 5 | Cache templates SPA | -0.1s |
| 6 | Cache authMiddleware | -0.1s |
| 7 | Invalidação de cache | 0s (corretude) |
| **Total** | | **-1.5s a -2s** |

**Resultado esperado:** De 3-5s para ~1-1.5s

---

## Testes Finais

### Teste de Performance

1. Limpar cache do navegador
2. Fazer login
3. Medir tempo até Dashboard carregar completamente
4. **Esperado:** < 1.5 segundos

### Teste de Navegação

1. Após login, navegar: Dashboard → Clients → Complaints → Integrations → Profile → Dashboard
2. Medir tempo de cada transição
3. **Esperado:** < 0.5 segundos cada

### Teste de Dados em Tempo Real

1. Abrir Dashboard
2. Em outra aba, criar uma reclamação via link público
3. Recarregar Dashboard
4. **Esperado:** Nova reclamação aparece imediatamente

### Teste de Consistência

1. Criar um cliente
2. Verificar que aparece na lista
3. Editar o cliente
4. Verificar que alterações aparecem
5. Deletar o cliente
6. Verificar que some da lista e do Dashboard

---

## Rollback

Se algo der errado, reverter os arquivos modificados:

```bash
git checkout HEAD -- views/app.html
git checkout HEAD -- public/js/app.js
git checkout HEAD -- server.js
git checkout HEAD -- routes/auth.js
git checkout HEAD -- routes/clients.js
git checkout HEAD -- middleware/auth.js
```

Ou restaurar do backup:
```bash
cp views/app.html.backup views/app.html
# etc.
```

---

## Ordem de Implementação Recomendada

1. **Fase 1** - Mais impacto, menor risco
2. **Fase 3** - Alto impacto, baixo risco
3. **Fase 2** - Médio impacto, baixo risco
4. **Fase 5** - Baixo impacto, risco zero
5. **Fase 4** - Médio impacto, requer atenção
6. **Fase 6** - Médio impacto, requer atenção
7. **Fase 7** - Essencial para corretude do cache

**Dica:** Implemente uma fase por vez e teste antes de prosseguir.
