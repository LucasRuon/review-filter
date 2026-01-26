# Especificacao de Melhorias - Opina Ja!

## Visao Geral

Este documento detalha o plano de implementacao para 4 melhorias solicitadas no sistema Opina Ja!

**Data:** Janeiro 2026
**Versao:** 1.0

---

## Indice

1. [Melhoria 1: Reclamacao por Filial](#melhoria-1-reclamacao-por-filial)
2. [Melhoria 2: Filtro e Exportacao por Filial](#melhoria-2-filtro-e-exportacao-por-filial)
3. [Melhoria 3: QR Code por Filial](#melhoria-3-qr-code-por-filial)
4. [Melhoria 4: Tela de Impressao Opina Ja!](#melhoria-4-tela-de-impressao-opina-ja)
5. [Ordem de Implementacao](#ordem-de-implementacao)
6. [Checklist de Testes](#checklist-de-testes)

---

## Melhoria 1: Reclamacao por Filial

### Objetivo
Permitir que o cliente informe de qual filial esta fazendo a reclamacao, vinculando a reclamacao a uma filial especifica.

### Situacao Atual
- A tabela `complaints` NAO possui coluna `branch_id`
- A pagina publica (`review.html`) mostra seletor de filiais mas NAO envia a informacao
- O endpoint `POST /r/:slug/complaint` nao recebe nem salva `branch_id`

### Arquivos a Modificar

#### 1.1 Database (`database.js`)

**Adicionar migration para nova coluna:**

```sql
-- Linha ~357 (array migrations)
'ALTER TABLE complaints ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES client_branches(id) ON DELETE SET NULL'
```

**Modificar funcao `createComplaint` (linha 608-613):**

```javascript
async function createComplaint(clientId, data) {
    await pool.query(`
        INSERT INTO complaints (client_id, branch_id, topic_id, topic_name, customer_name, customer_email, customer_phone, complaint_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [clientId, data.branch_id || null, data.topic_id || null, data.topic_name || null, data.name, data.email, data.phone, data.complaint]);
}
```

**Modificar funcao `getAllComplaintsByUserId` (linha 686-695):**

```javascript
async function getAllComplaintsByUserId(userId) {
    const result = await pool.query(`
        SELECT c.*, cl.name as client_name, cb.name as branch_name
        FROM complaints c
        JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN client_branches cb ON c.branch_id = cb.id
        WHERE cl.user_id = $1
        ORDER BY c.created_at DESC
    `, [userId]);
    return result.rows;
}
```

**Modificar funcao `getComplaintsByClientId` (linha 615-621):**

```javascript
async function getComplaintsByClientId(clientId) {
    const result = await pool.query(`
        SELECT c.*, cb.name as branch_name
        FROM complaints c
        LEFT JOIN client_branches cb ON c.branch_id = cb.id
        WHERE c.client_id = $1
        ORDER BY c.created_at DESC
    `, [clientId]);
    return result.rows;
}
```

#### 1.2 API Routes (`routes/review.js`)

**Modificar endpoint `POST /:slug/complaint` (linha 55-165):**

Adicionar `branch_id` no destructuring:
```javascript
// Linha 62
const { name, email, phone, complaint, topic_id, topic_name, branch_id } = req.body;
```

Passar `branch_id` para `createComplaint`:
```javascript
// Linha 68
await db.createComplaint(client.id, { name, email, phone, complaint, topic_id, topic_name, branch_id });
```

Adicionar `branch_name` no webhook:
```javascript
// Linha 127-137 (webhookData)
const branch = branch_id ? await db.getBranchById(branch_id, client.id) : null;
const webhookData = {
    test: false,
    timestamp: new Date().toISOString(),
    client_id: client.id,
    client_name: client.name,
    branch_id: branch_id || null,
    branch_name: branch?.name || null,
    customer_name: name,
    // ... resto dos campos
};
```

#### 1.3 Frontend (`views/review.html`)

**Modificar funcao de submit do formulario (linha 365-393):**

```javascript
// Obter branch selecionada
const selectedBranchChip = document.querySelector('.branch-chip.active');
const branch_id = selectedBranchChip?.dataset.id === 'main' ? null : selectedBranchChip?.dataset.id;

// Adicionar no body do fetch (linha 377-384)
body: JSON.stringify({
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    complaint: f.complaint.value.trim(),
    topic_id: selectedTopic?.id || null,
    topic_name: selectedTopic?.name || null,
    branch_id: branch_id ? parseInt(branch_id) : null
})
```

#### 1.4 WhatsApp Message (`routes/review.js`)

**Adicionar variavel de filial na mensagem (linha 95-102):**

```javascript
const branch = branch_id ? await db.getBranchById(branch_id, client.id) : null;
const message = whatsappService.replaceMessageVariables(integrations.whatsapp_message, {
    clientName: client.name,
    branchName: branch?.name || 'Sede Principal',
    customerName: name,
    // ... resto
});
```

---

## Melhoria 2: Filtro e Exportacao por Filial

### Objetivo
Adicionar filtro por filial na tela de reclamacoes e incluir a filial no CSV exportado.

### Situacao Atual
- Tela `all-complaints.html` tem filtros por cliente e status
- Exportacao CSV nao inclui coluna de filial
- Nao existe dropdown de filiais

### Arquivos a Modificar

#### 2.1 API Routes (`routes/clients.js`)

**Adicionar endpoint para listar reclamacoes com filtro de filial:**

Criar ou modificar endpoint `GET /api/complaints`:

```javascript
// Adicionar query param branch_id
router.get('/complaints', authenticateToken, async (req, res) => {
    try {
        const { client_id, status, branch_id } = req.query;
        let complaints = await db.getAllComplaintsByUserId(req.user.userId);

        if (client_id) {
            complaints = complaints.filter(c => c.client_id == client_id);
        }
        if (status) {
            complaints = complaints.filter(c => c.status === status);
        }
        if (branch_id) {
            if (branch_id === 'main') {
                complaints = complaints.filter(c => !c.branch_id);
            } else {
                complaints = complaints.filter(c => c.branch_id == branch_id);
            }
        }

        res.json(complaints);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar reclamacoes' });
    }
});
```

#### 2.2 Frontend (`views/spa/all-complaints.html`)

**Adicionar dropdown de filial:**

```html
<!-- Apos linha 24 (select de status) -->
<div class="form-group" style="margin:0;flex:1;min-width:200px">
    <select id="branchFilter" class="form-input form-select" onchange="filterComplaints()" disabled>
        <option value="">Todas as filiais</option>
        <option value="main">Sede Principal</option>
    </select>
</div>
```

#### 2.3 Frontend (`views/app.html`)

**Modificar funcao `loadAllComplaintsData`:**

```javascript
// Adicionar logica para popular dropdown de filiais quando cliente e selecionado
window.loadBranchesForFilter = async function(clientId) {
    const branchSelect = document.getElementById('branchFilter');
    if (!clientId) {
        branchSelect.disabled = true;
        branchSelect.innerHTML = '<option value="">Todas as filiais</option>';
        return;
    }

    const branches = await api.get(`/api/clients/${clientId}/branches`);
    branchSelect.disabled = false;
    branchSelect.innerHTML = '<option value="">Todas as filiais</option><option value="main">Sede Principal</option>';
    branches.forEach(b => {
        if (b.active) {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        }
    });
};
```

**Modificar funcao `filterComplaints`:**

```javascript
window.filterComplaints = function() {
    const clientFilter = document.getElementById('clientFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const branchFilter = document.getElementById('branchFilter')?.value || '';

    let filtered = window.allComplaints || [];

    if (clientFilter) {
        filtered = filtered.filter(c => c.client_id == clientFilter);
    }
    if (statusFilter) {
        filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (branchFilter) {
        if (branchFilter === 'main') {
            filtered = filtered.filter(c => !c.branch_id);
        } else {
            filtered = filtered.filter(c => c.branch_id == branchFilter);
        }
    }

    renderComplaints(filtered);
};
```

**Modificar funcao `exportCSV` (linha 1558-1580):**

```javascript
window.exportCSV = function() {
    const complaints = window.filteredComplaints || window.allComplaints || [];
    if (complaints.length === 0) {
        showToast('Nenhuma reclamacao para exportar', 'error');
        return;
    }

    // Adicionar coluna Filial
    const headers = ['Cliente', 'Filial', 'Nome', 'Email', 'Telefone', 'Topico', 'Reclamacao', 'Status', 'Data'];
    const rows = complaints.map(c => [
        c.client_name,
        c.branch_name || 'Sede Principal',
        c.customer_name,
        c.customer_email,
        c.customer_phone,
        c.topic_name || '',
        c.complaint_text.replace(/"/g, '""'),
        c.status === 'pending' ? 'Pendente' : c.status === 'resolved' ? 'Resolvido' : c.status === 'in_progress' ? 'Em andamento' : 'Dispensado',
        new Date(c.created_at).toLocaleString('pt-BR')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reclamacoes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('CSV exportado!');
};
```

---

## Melhoria 3: QR Code por Filial

### Objetivo
Permitir gerar QR Code especifico para cada filial, com link para Google Review da filial.

### Situacao Atual
- Tabela `client_branches` NAO possui campo `google_review_link`
- QR Code existe apenas para o cliente principal
- Funcao `showQRCode` ja esta implementada e pode ser reutilizada

### Arquivos a Modificar

#### 3.1 Database (`database.js`)

**Adicionar migration para nova coluna:**

```sql
-- Linha ~357 (array migrations)
'ALTER TABLE client_branches ADD COLUMN IF NOT EXISTS google_review_link TEXT'
```

**Modificar funcao `createBranch` (linha 529-536):**

```javascript
async function createBranch(clientId, data) {
    const result = await pool.query(`
        INSERT INTO client_branches (client_id, name, address, phone, business_hours, is_main, google_review_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `, [clientId, data.name, data.address, data.phone || null, data.business_hours || null, data.is_main || 0, data.google_review_link || null]);
    return { id: result.rows[0].id };
}
```

**Modificar funcao `updateBranch` (linha 538-544):**

```javascript
async function updateBranch(id, clientId, data) {
    await pool.query(`
        UPDATE client_branches
        SET name = $1, address = $2, phone = $3, business_hours = $4, is_main = $5, active = $6, google_review_link = $7
        WHERE id = $8 AND client_id = $9
    `, [data.name, data.address, data.phone || null, data.business_hours || null, data.is_main || 0, data.active !== undefined ? data.active : 1, data.google_review_link || null, id, clientId]);
}
```

#### 3.2 Frontend (`views/spa/client-branches.html`)

**Adicionar campo no formulario de filial (apos linha 63):**

```html
<div class="form-group">
    <label class="form-label">Link Google Review da Filial</label>
    <input type="url" id="branchGoogleReview" class="form-input" placeholder="https://g.page/r/...">
    <small style="color:var(--text-muted);font-size:0.8rem">Opcional. Deixe em branco para usar o link do estabelecimento principal.</small>
</div>
```

**Adicionar botao QR Code no card de filial:**

```html
<!-- No template de renderizacao de filiais -->
<button class="btn btn-ghost btn-sm" onclick="showBranchQRCode(${branch.id}, '${branch.name}', '${branch.google_review_link || ''}')" title="QR Code">
    <i class="fas fa-qrcode"></i>
</button>
```

#### 3.3 Frontend (`views/app.html`)

**Adicionar funcao para QR Code de filial:**

```javascript
window.showBranchQRCode = function(branchId, branchName, googleReviewLink) {
    // Se a filial nao tem link proprio, usar o do cliente
    const clientLink = window.currentClientGoogleReview || '';
    const link = googleReviewLink || clientLink;

    if (!link) {
        showToast('Nenhum link do Google Review configurado', 'error');
        return;
    }

    // Reutilizar a funcao existente
    window.showQRCode(`${window.currentClientName} - ${branchName}`, link);
};
```

#### 3.4 API Routes (`routes/clients.js`)

**Atualizar endpoints de branches para incluir google_review_link:**

No POST e PUT de branches, adicionar o campo:

```javascript
// POST /api/clients/:id/branches
const { name, address, phone, business_hours, is_main, google_review_link } = req.body;
await db.createBranch(clientId, { name, address, phone, business_hours, is_main, google_review_link });

// PUT /api/clients/:clientId/branches/:branchId
const { name, address, phone, business_hours, is_main, active, google_review_link } = req.body;
await db.updateBranch(branchId, clientId, { name, address, phone, business_hours, is_main, active, google_review_link });
```

---

## Melhoria 4: Tela de Impressao Opina Ja!

### Objetivo
Criar template de impressao profissional com QR Code para exibicao em loja fisica.

### Situacao Atual
- Funcao `printQRCode` existe mas e basica (linha 1069-1122)
- Nao ha personalizacao com logo ou cores da empresa
- Nao ha versao para filial especifica

### Arquivos a Modificar

#### 4.1 Frontend (`views/app.html`)

**Criar nova funcao `printStoreDisplay`:**

```javascript
window.printStoreDisplay = function(options = {}) {
    const {
        clientName = window.currentQRClientName,
        link = window.currentQRLink,
        logoUrl = null,
        primaryColor = '#3750F0',
        branchName = null,
        size = 'A5' // 'A4', 'A5', 'A6'
    } = options;

    const container = document.getElementById('qr-canvas');
    const img = container.querySelector('img');
    const canvas = container.querySelector('canvas');

    let qrDataUrl;
    if (img) {
        qrDataUrl = img.src;
    } else if (canvas) {
        qrDataUrl = canvas.toDataURL('image/png');
    } else {
        showToast('Erro ao gerar impressao', 'error');
        return;
    }

    const displayTitle = branchName ? `${clientName} - ${branchName}` : clientName;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Opina Ja! - ${displayTitle}</title>
            <style>
                @page { size: ${size}; margin: 0; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
                .container {
                    background: white;
                    border-radius: 24px;
                    padding: 2.5rem;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 90%;
                }
                .logo {
                    max-width: 180px;
                    max-height: 60px;
                    margin-bottom: 1.5rem;
                }
                .logo-text {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: ${primaryColor};
                    margin-bottom: 1.5rem;
                }
                .title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1E293B;
                    margin-bottom: 0.5rem;
                }
                .subtitle {
                    font-size: 1rem;
                    color: #64748B;
                    margin-bottom: 1.5rem;
                }
                .qr-container {
                    background: white;
                    padding: 1rem;
                    border-radius: 16px;
                    border: 3px solid ${primaryColor};
                    display: inline-block;
                    margin-bottom: 1.5rem;
                }
                .qr-container img {
                    width: 200px;
                    height: 200px;
                }
                .instructions {
                    background: #F1F5F9;
                    padding: 1rem 1.5rem;
                    border-radius: 12px;
                    margin-bottom: 1rem;
                }
                .instructions h3 {
                    color: ${primaryColor};
                    font-size: 1.1rem;
                    margin-bottom: 0.5rem;
                }
                .instructions p {
                    color: #475569;
                    font-size: 0.9rem;
                    line-height: 1.5;
                }
                .stars {
                    color: #FBBF24;
                    font-size: 1.5rem;
                    letter-spacing: 0.25rem;
                    margin-bottom: 1rem;
                }
                .footer {
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid #E2E8F0;
                }
                .footer p {
                    color: #94A3B8;
                    font-size: 0.75rem;
                }
                .powered-by {
                    margin-top: 2rem;
                    color: rgba(255,255,255,0.7);
                    font-size: 0.75rem;
                }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="${clientName}">` : `<div class="logo-text">${clientName}</div>`}
                ${branchName ? `<p style="color:#64748B;margin-bottom:1rem;font-size:0.9rem">${branchName}</p>` : ''}

                <h1 class="title">Sua opiniao e muito importante!</h1>
                <p class="subtitle">Avalie nossa experiencia</p>

                <div class="stars">&#9733; &#9733; &#9733; &#9733; &#9733;</div>

                <div class="qr-container">
                    <img src="${qrDataUrl}" alt="QR Code">
                </div>

                <div class="instructions">
                    <h3>Como avaliar:</h3>
                    <p>1. Abra a camera do seu celular<br>
                       2. Aponte para o QR Code acima<br>
                       3. Clique no link que aparecer<br>
                       4. Deixe sua avaliacao!</p>
                </div>

                <div class="footer">
                    <p>Obrigado por nos ajudar a melhorar!</p>
                </div>
            </div>

            <p class="powered-by">Powered by Opina Ja!</p>

            <button class="no-print" onclick="window.print()" style="margin-top:2rem;padding:1rem 2rem;background:white;color:${primaryColor};border:none;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:600;">
                Imprimir
            </button>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// Funcao auxiliar para ajustar cor
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
```

#### 4.2 Modal QR Code (`views/app.html`)

**Adicionar botao no modal de QR Code:**

Localizar o modal `qrCodeClientModal` e adicionar:

```html
<button class="btn btn-secondary" onclick="printStoreDisplay({ clientName: window.currentQRClientName, link: window.currentQRLink, primaryColor: window.currentClientColor, logoUrl: window.currentClientLogo })">
    <i class="fas fa-store"></i> Imprimir para Loja
</button>
```

#### 4.3 Opcoes de Tamanho

**Adicionar seletor de tamanho antes da impressao:**

```javascript
window.showPrintOptions = function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px">
            <div class="modal-header">
                <h3>Opcoes de Impressao</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Tamanho do papel</label>
                    <select id="printSize" class="form-input form-select">
                        <option value="A4">A4 (21 x 29.7 cm)</option>
                        <option value="A5" selected>A5 (14.8 x 21 cm) - Recomendado</option>
                        <option value="A6">A6 (10.5 x 14.8 cm)</option>
                    </select>
                </div>
                <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.5rem">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button class="btn btn-primary" onclick="executePrint()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.executePrint = function() {
    const size = document.getElementById('printSize').value;
    document.querySelector('.modal:last-child').remove();
    printStoreDisplay({
        size: size,
        clientName: window.currentQRClientName,
        link: window.currentQRLink,
        primaryColor: window.currentClientColor || '#3750F0',
        logoUrl: window.currentClientLogo || null
    });
};
```

---

## Ordem de Implementacao

### Fase 1: Base de Dados e Backend
1. Adicionar migrations no `database.js`:
   - `branch_id` na tabela `complaints`
   - `google_review_link` na tabela `client_branches`
2. Atualizar funcoes do database
3. Atualizar endpoints da API

### Fase 2: Melhoria 1 - Reclamacao por Filial
1. Modificar `routes/review.js`
2. Atualizar `views/review.html`
3. Testar submissao de reclamacao com filial

### Fase 3: Melhoria 2 - Filtro e Exportacao
1. Adicionar dropdown de filial em `all-complaints.html`
2. Atualizar funcao `filterComplaints`
3. Atualizar funcao `exportCSV`
4. Testar filtros e exportacao

### Fase 4: Melhoria 3 - QR Code por Filial
1. Adicionar campo no formulario de filial
2. Adicionar botao QR Code no card de filial
3. Criar funcao `showBranchQRCode`
4. Testar geracao de QR Code

### Fase 5: Melhoria 4 - Tela de Impressao
1. Criar funcao `printStoreDisplay`
2. Adicionar modal de opcoes
3. Integrar com QR Code existente
4. Testar impressao em diferentes tamanhos

---

## Checklist de Testes

### Melhoria 1: Reclamacao por Filial
- [ ] Criar reclamacao sem filial (sede principal)
- [ ] Criar reclamacao selecionando uma filial
- [ ] Verificar se `branch_id` e salvo no banco
- [ ] Verificar notificacao WhatsApp com nome da filial
- [ ] Verificar webhook com dados da filial

### Melhoria 2: Filtro e Exportacao
- [ ] Filtrar por cliente especifico
- [ ] Filtrar por filial especifica
- [ ] Filtrar por "Sede Principal"
- [ ] Combinar filtros (cliente + filial + status)
- [ ] Exportar CSV com coluna de filial
- [ ] Verificar se filtro de filial desabilita quando nenhum cliente selecionado

### Melhoria 3: QR Code por Filial
- [ ] Adicionar link Google Review em filial
- [ ] Editar link Google Review de filial
- [ ] Gerar QR Code de filial com link proprio
- [ ] Gerar QR Code de filial sem link (usar link do cliente)
- [ ] Download do QR Code de filial

### Melhoria 4: Tela de Impressao
- [ ] Imprimir em tamanho A4
- [ ] Imprimir em tamanho A5
- [ ] Imprimir em tamanho A6
- [ ] Verificar cores personalizadas
- [ ] Verificar logo do cliente
- [ ] Imprimir para filial especifica
- [ ] Testar impressao real em impressora

---

## Estimativa de Arquivos Modificados

| Arquivo | Melhorias |
|---------|-----------|
| `database.js` | 1, 2, 3 |
| `routes/review.js` | 1 |
| `routes/clients.js` | 2, 3 |
| `views/review.html` | 1 |
| `views/spa/all-complaints.html` | 2 |
| `views/spa/client-branches.html` | 3 |
| `views/app.html` | 2, 3, 4 |

**Total: 7 arquivos**

---

## Notas Importantes

1. **Backward Compatibility**: Todas as mudancas sao retrocompativeis. Reclamacoes existentes terao `branch_id = NULL` (sede principal).

2. **Performance**: Os JOINs adicionados nas queries sao indexados por foreign keys existentes.

3. **UX**: O filtro de filial so aparece apos selecionar um cliente, evitando confusao.

4. **Impressao**: O template usa CSS de impressao para garantir fidelidade de cores.

5. **Mobile**: O seletor de filial no `review.html` ja e responsivo (chips flexiveis).
