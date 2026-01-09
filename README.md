# Review Filter - Sistema de Filtro de Avaliações

Sistema para gerenciar avaliações de clientes, direcionando feedbacks positivos para o Google e capturando reclamações internamente.

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Motivo |
|--------|------------|--------|
| Backend | Node.js + Express | Leve, rápido, fácil de manter |
| Banco | SQLite (better-sqlite3) | Zero configuração, arquivo único |
| Auth | JWT (jsonwebtoken) | Stateless, escalável |
| Senhas | bcryptjs | Hash seguro |
| Frontend | HTML/CSS/JS puro | Sem build, funciona em qualquer lugar |
| Estilo | CSS Variables + Flexbox/Grid | Responsivo |

## 📁 Estrutura

```
review-filter/
├── server.js           # Servidor Express
├── database.js         # SQLite + queries
├── middleware/
│   └── auth.js         # JWT middleware
├── routes/
│   ├── auth.js         # Login, registro, perfil
│   ├── clients.js      # CRUD clientes
│   └── review.js       # Página pública
├── public/
│   ├── css/style.css   # Estilos
│   └── js/app.js       # JS cliente
├── views/              # HTML pages
└── data/               # SQLite database
```

## 🚀 Rodar Localmente

```bash
# Instalar dependências
npm install

# Criar arquivo .env
cp .env.example .env

# Rodar
npm start
```

Acesse: **http://localhost:3000**

## 🌐 Deploy no Railway

1. Push para GitHub
2. No Railway: **New Project** → **Deploy from GitHub**
3. Adicionar variável: `JWT_SECRET=sua-chave-secreta`
4. Gerar domínio em **Settings → Networking**

## 📱 Como Funciona

1. Cadastre-se e faça login
2. Adicione clientes com link do Google Reviews
3. Compartilhe o link gerado: `seusite.com/r/abc123`
4. Elogios → Google Reviews | Reclamações → Dashboard
