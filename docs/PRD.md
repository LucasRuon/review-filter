# PRD - Pesquisa: Página de Impressão QR Code para Loja Física

## Objetivo da Pesquisa

Documentar a localização e funcionamento da página/funcionalidade de impressão de QR Code para loja física no sistema Opina Já!.

---

## Estrutura de Arquivos

```
views/
├── app.html .......................... Arquivo principal com toda lógica JavaScript
│   ├── showQRCode() .................. Exibe modal do QR Code (linha 1050-1093)
│   ├── downloadQRCode() .............. Download do QR como PNG (linha 1099-1118)
│   ├── printQRCode() ................. Impressão simples do QR (linha 1120-1173)
│   ├── showBranchQRCode() ............ QR Code específico de filial (linha 1176-1189)
│   ├── adjustColor() ................. Função auxiliar de cor (linha 1192-1199)
│   ├── printStoreDisplay() ........... Impressão profissional para loja (linha 1202-1369)
│   ├── showPrintOptions() ............ Modal de opções de tamanho (linha 1372-1405)
│   └── executePrint() ................ Executa impressão com opções (linha 1407-1421)
│
├── spa/
│   ├── clients.html .................. Modal do QR Code (linha 16-41)
│   │   └── #qrCodeClientModal ........ Container do modal
│   │       ├── #qr-modal-title ....... Título do modal
│   │       ├── #qr-canvas ............ Canvas onde QR é renderizado
│   │       ├── #qr-link-text ......... Texto do link
│   │       └── Botões de ação ........ Download, Imprimir, Imprimir para Loja
│   │
│   └── client-branches.html .......... Página de gerenciamento de filiais (linha 1-83)
│       ├── .branches-grid ............ Grid de cards das filiais
│       └── #branchModal .............. Modal para criar/editar filial

routes/
└── clients.js ........................ API endpoints das filiais
    ├── GET /:id/branches ............. Lista filiais (linha 348-360)
    ├── POST /:id/branches ............ Cria filial (linha 362-379)
    ├── PUT /:clientId/branches/:branchId  Atualiza filial (linha 381-397)
    └── DELETE /:clientId/branches/:branchId  Remove filial (linha 399-415)

database.js ........................... Funções de banco de dados
    ├── getBranchesByClientId() ....... Busca filiais por cliente (linha 687-700)
    ├── getBranchById() ............... Busca filial específica (linha 702-708)
    ├── createBranch() ................ Cria nova filial (linha 710-717)
    ├── updateBranch() ................ Atualiza filial (linha 719-725)
    └── deleteBranch() ................ Remove filial (linha 727-729)
```

---

## Fluxo de Dados

### Fluxo 1: Exibir QR Code de Cliente

```
[Clique no botão QR]
    → showQRCode(clientName, link) [views/app.html:1050]
        → Limpa container #qr-canvas [views/app.html:1070]
        → new QRCode(container, {text, width, height, ...}) [views/app.html:1079]
        → Modal exibido [views/app.html:1088]
```

### Fluxo 2: Imprimir para Loja (Profissional)

```
[Clique em "Imprimir para Loja"]
    → showPrintOptions() [views/app.html:1372]
        → Cria modal dinâmico #printOptionsModal [views/app.html:1377-1404]
        → Usuário seleciona tamanho (A4/A5/A6)
    → executePrint() [views/app.html:1407]
        → Obtém tamanho selecionado [views/app.html:1408]
        → Remove modal [views/app.html:1409]
        → Busca dados do cliente atual [views/app.html:1412]
        → printStoreDisplay(options) [views/app.html:1414]
            → Extrai QR do canvas/img [views/app.html:1217-1224]
            → Abre nova janela [views/app.html:1229]
            → Gera HTML profissional com CSS [views/app.html:1230-1367]
            → Exibe botão de impressão
```

### Fluxo 3: QR Code de Filial

```
[Clique no botão QR da filial]
    → showBranchQRCode(branchId, branchName, googleReviewLink) [views/app.html:1176]
        → Busca cliente atual [views/app.html:1178]
        → Usa link da filial ou fallback para cliente [views/app.html:1180]
        → showQRCode(`${clientName} - ${branchName}`, link) [views/app.html:1188]
```

---

## Dependências

| Arquivo | Depende de | Tipo |
|---------|-----------|------|
| `views/app.html` | qrcodejs (CDN) | Biblioteca externa |
| `views/app.html` | window.clients | Estado global |
| `views/app.html` | window.currentClientId | Estado global |
| `views/app.html` | window.currentQRClientName | Estado global |
| `views/app.html` | window.currentQRLink | Estado global |
| `views/spa/clients.html` | app.html (funções) | JavaScript |
| `views/spa/client-branches.html` | app.html (funções) | JavaScript |
| `routes/clients.js` | database.js | Database |
| `routes/clients.js` | authMiddleware | Middleware |

---

## Componentes do Modal QR Code

### Modal Principal (`#qrCodeClientModal`)
**Localização:** `views/spa/clients.html:16-41`

| Elemento | ID | Função |
|----------|-----|--------|
| Título | `qr-modal-title` | Exibe nome do cliente/filial |
| Canvas QR | `qr-canvas` | Renderiza o QR Code |
| Link | `qr-link-text` | Mostra URL do Google Review |
| Botão Download | - | Chama `downloadQRCode()` |
| Botão Imprimir | - | Chama `printQRCode()` |
| Botão Loja | - | Chama `showPrintOptions()` |

### Modal de Opções (`#printOptionsModal`)
**Localização:** Criado dinamicamente em `views/app.html:1377-1404`

| Elemento | ID | Função |
|----------|-----|--------|
| Select tamanho | `printSize` | Seleciona A4/A5/A6 |
| Botão Cancelar | - | Remove modal |
| Botão Imprimir | - | Chama `executePrint()` |

---

## Funções Principais

### `showQRCode(clientName, link)`
**Localização:** `views/app.html:1050-1093`

- Armazena dados em variáveis globais (`currentQRClientName`, `currentQRLink`)
- Limpa QR Code anterior
- Gera novo QR Code usando biblioteca qrcodejs
- Exibe modal

### `printStoreDisplay(options)`
**Localização:** `views/app.html:1202-1369`

**Parâmetros:**
```javascript
{
    clientName: string,      // Nome do cliente
    link: string,            // URL do Google Review
    logoUrl: string|null,    // Logo do estabelecimento
    primaryColor: string,    // Cor primária (#3750F0 default)
    branchName: string|null, // Nome da filial
    size: string             // Tamanho: 'A4', 'A5', 'A6'
}
```

**Layout gerado:**
- Fundo gradiente com cor primária
- Card branco centralizado
- Logo ou nome do estabelecimento
- Nome da filial (se aplicável)
- Título "Sua opinião é muito importante!"
- Subtítulo "Avalie nossa experiência"
- 5 estrelas douradas
- QR Code com borda colorida
- Instruções passo a passo
- Rodapé "Obrigado por nos ajudar a melhorar!"
- Watermark "Powered by Opina Já!"

### `showPrintOptions()`
**Localização:** `views/app.html:1372-1405`

- Remove modal existente se houver
- Cria modal dinâmico com select de tamanhos
- Opções: A4 (21x29.7cm), A5 (14.8x21cm - recomendado), A6 (10.5x14.8cm)

### `executePrint()`
**Localização:** `views/app.html:1407-1421`

- Obtém tamanho selecionado
- Busca dados do cliente atual (cor primária, logo)
- Chama `printStoreDisplay()` com as opções

---

## Schema do Banco (Filiais)

**Tabela:** `client_branches`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | serial | ID único |
| client_id | integer | FK para clients |
| name | varchar | Nome da filial |
| address | varchar | Endereço completo |
| phone | varchar | Telefone |
| business_hours | varchar | Horário de funcionamento |
| is_main | boolean | Se é filial principal |
| google_review_link | varchar | Link específico do Google Review |
| active | boolean | Status ativo/inativo |

---

## Endpoints da API

### GET `/api/clients/:id/branches`
**Localização:** `routes/clients.js:348-360`

Retorna lista de todas as filiais de um cliente.

### POST `/api/clients/:id/branches`
**Localização:** `routes/clients.js:362-379`

Cria nova filial.

**Body:**
```json
{
    "name": "string (obrigatório)",
    "address": "string (obrigatório)",
    "phone": "string",
    "business_hours": "string",
    "is_main": "boolean",
    "google_review_link": "string"
}
```

### PUT `/api/clients/:clientId/branches/:branchId`
**Localização:** `routes/clients.js:381-397`

Atualiza dados de uma filial.

### DELETE `/api/clients/:clientId/branches/:branchId`
**Localização:** `routes/clients.js:399-415`

Remove uma filial.

---

## Biblioteca Externa

**QRCode.js**
- CDN: `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`
- Uso: Gera QR Code no canvas
- Configuração atual:
  - Width: 256px
  - Height: 256px
  - Cor escura: #000000
  - Cor clara: #ffffff
  - Nível de correção: H (High)

---

## Resposta Objetiva

**Localização da página de impressão do QR Code:**

A funcionalidade de impressão de QR Code para loja física **não é uma página separada**, mas sim um conjunto de funções JavaScript implementadas no arquivo principal `views/app.html`.

**Arquivos principais:**
1. **Modal HTML:** `views/spa/clients.html:16-41`
2. **Lógica JavaScript:** `views/app.html:1050-1421`
3. **Função principal de impressão:** `printStoreDisplay()` em `views/app.html:1202-1369`

**Pontos de entrada:**
- Botão "QR Code" nos cards de clientes → `showQRCode()`
- Botão "Imprimir para Loja" no modal → `showPrintOptions()` → `executePrint()` → `printStoreDisplay()`
- Botão "QR Code" nas filiais → `showBranchQRCode()` → `showQRCode()`

**Para implementar melhorias nesta tela**, você precisará modificar:
- `views/app.html` - Funções JavaScript (linhas 1050-1421)
- `views/spa/clients.html` - Template HTML do modal (linhas 16-41)
