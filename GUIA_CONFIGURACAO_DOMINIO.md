# Guia Completo de Configuração - Opina Já!

## Estrutura Final
- **opinaja.com.br** → Landing Page (Hostgator)
- **app.opinaja.com.br** → Aplicação (Railway)

---

## PARTE 1: Configuração DNS na Hostgator

### Passo 1: Acessar o cPanel da Hostgator
1. Acesse o painel de controle da Hostgator
2. Faça login no **cPanel**

### Passo 2: Configurar o Domínio Principal (opinaja.com.br)
1. No cPanel, procure por "**Zonas DNS**" ou "**Zone Editor**"
2. Localize o domínio **opinaja.com.br**
3. Certifique-se de que existe um registro **A** apontando para o IP da Hostgator
   - Tipo: **A**
   - Nome: **@** (ou opinaja.com.br)
   - Destino: **IP do servidor Hostgator** (normalmente já está configurado)

### Passo 3: Criar Subdomínio para a Aplicação (app.opinaja.com.br)

#### 3.1: Criar o Subdomínio
1. No cPanel, procure por "**Subdomínios**" ou "**Subdomains**"
2. Clique em "Criar Subdomínio" ou "Create Subdomain"
3. Preencha:
   - **Subdomínio**: `app`
   - **Domínio**: `opinaja.com.br`
   - **Document Root**: Pode deixar o padrão (não será usado)
4. Clique em "Criar"

#### 3.2: Configurar DNS do Subdomínio para Railway
1. Volte para "**Zonas DNS**" ou "**Zone Editor**"
2. Procure o domínio **opinaja.com.br**
3. Você verá um registro para **app.opinaja.com.br** criado automaticamente
4. **IMPORTANTE**: Você precisará alterar ou adicionar registros DNS

**AGUARDE!** Antes de configurar os registros DNS, você precisa obter as informações da Railway primeiro.

---

## PARTE 2: Configuração na Railway

### Passo 1: Acessar o Projeto na Railway
1. Acesse [railway.app](https://railway.app)
2. Faça login na sua conta
3. Selecione o projeto do **Opina Já**

### Passo 2: Adicionar Domínio Customizado
1. No painel do projeto, clique na aba "**Settings**" ou "**Configurações**"
2. Procure por "**Domains**" ou "**Custom Domain**"
3. Clique em "**Add Domain**" ou "**Adicionar Domínio**"
4. Digite: `app.opinaja.com.br`
5. Clique em "Add" ou "Adicionar"

### Passo 3: Obter Informações DNS da Railway
Após adicionar o domínio, a Railway mostrará as informações necessárias para configuração DNS.

A Railway pode fornecer **DUAS OPÇÕES**:

#### Opção A: Registro CNAME (Mais Comum)
```
Tipo: CNAME
Nome: app
Destino: <seu-projeto>.up.railway.app
```

#### Opção B: Registros A (Menos Comum)
```
Tipo: A
Nome: app
Destino: <IP fornecido pela Railway>
```

**COPIE ESSAS INFORMAÇÕES!** Você usará no próximo passo.

---

## PARTE 3: Finalizar Configuração DNS na Hostgator

### Passo 1: Voltar ao cPanel da Hostgator
1. Acesse novamente "**Zonas DNS**" ou "**Zone Editor**"
2. Localize o domínio **opinaja.com.br**

### Passo 2: Configurar o Registro para app.opinaja.com.br

#### Se a Railway forneceu CNAME:
1. Procure se já existe um registro para "**app**"
2. Se existir um registro **A** para "app", **DELETE-O**
3. Adicione um novo registro:
   - **Tipo**: CNAME
   - **Nome**: app
   - **Destino**: `<seu-projeto>.up.railway.app` (o valor que a Railway forneceu)
   - **TTL**: 14400 (ou deixe o padrão)
4. Clique em "Adicionar Registro" ou "Save"

#### Se a Railway forneceu IP (Registro A):
1. Procure se já existe um registro para "**app**"
2. Se sim, edite-o. Se não, crie um novo:
   - **Tipo**: A
   - **Nome**: app
   - **Destino**: IP fornecido pela Railway
   - **TTL**: 14400 (ou deixe o padrão)
3. Clique em "Adicionar Registro" ou "Save"

---

## PARTE 4: Upload dos Arquivos da Landing Page

### Passo 1: Preparar os Arquivos
Você precisará fazer upload dos seguintes arquivos para a Hostgator:

**Estrutura de Pastas:**
```
public_html/
├── index.html (landing page)
├── privacy.html
├── terms.html
└── images/
    ├── logo-dark.png
    ├── logo-icon-dark.png
    └── og-image.png (se houver)
```

### Passo 2: Acessar o Gerenciador de Arquivos
1. No cPanel da Hostgator, procure por "**Gerenciador de Arquivos**" ou "**File Manager**"
2. Navegue até a pasta **public_html**
3. Se houver arquivos padrão (como index.html da Hostgator), você pode deletá-los

### Passo 3: Fazer Upload
1. Clique em "**Upload**" ou "**Enviar**"
2. Faça upload dos arquivos:
   - `landing.html` → renomeie para `index.html` DEPOIS do upload
   - `privacy.html`
   - `terms.html`
3. Crie uma pasta chamada "**images**" (se não existir)
4. Entre na pasta images e faça upload das imagens da logo

### Passo 4: Renomear Arquivo
1. Após o upload, localize o arquivo `landing.html`
2. Clique com botão direito → Renomear
3. Renomeie para `index.html`

---

## PARTE 5: Verificação e Testes

### Passo 1: Aguardar Propagação DNS
- A propagação DNS pode levar de **15 minutos a 48 horas**
- Normalmente leva cerca de **1-2 horas**

### Passo 2: Verificar Propagação
Você pode verificar se o DNS propagou usando:
- Site: [whatsmydns.net](https://www.whatsmydns.net)
- Digite: `app.opinaja.com.br`
- Escolha o tipo: CNAME (ou A, dependendo do que você configurou)
- Clique em "Search"

### Passo 3: Testar os Domínios

#### Testar Landing Page:
1. Abra o navegador
2. Acesse: `https://opinaja.com.br`
3. Verifique se a landing page carrega corretamente

#### Testar Aplicação:
1. Abra o navegador
2. Acesse: `https://app.opinaja.com.br`
3. Verifique se a aplicação da Railway carrega

#### Testar Links da Landing Page:
1. Na landing page (opinaja.com.br)
2. Clique nos botões "Entrar", "Criar conta", etc.
3. Verifique se redirecionam para `app.opinaja.com.br/login` ou `app.opinaja.com.br/register`

---

## PARTE 6: Configurar Variáveis de Ambiente na Railway

### Atualizar BASE_URL
1. No painel da Railway, vá em "**Variables**" ou "**Variáveis de Ambiente**"
2. Procure por `BASE_URL`
3. Se não existir, crie uma nova variável:
   - **Nome**: `BASE_URL`
   - **Valor**: `https://app.opinaja.com.br`
4. Salve as alterações
5. A aplicação será reiniciada automaticamente

---

## PARTE 7: Atualizar Links Internos da Aplicação (Se Necessário)

Se a aplicação tiver links hardcoded apontando para localhost ou Railway, você precisará atualizar:

### Arquivos que podem precisar de atualização:
- `server.js` - verificar se usa BASE_URL das variáveis de ambiente
- Links de e-mail - verificar se usam a variável BASE_URL
- Links de redirecionamento - garantir que usam o domínio correto

---

## Checklist Final ✅

### DNS Configurado:
- [ ] Registro A ou CNAME para opinaja.com.br configurado
- [ ] Registro CNAME ou A para app.opinaja.com.br apontando para Railway
- [ ] DNS propagado (verificado em whatsmydns.net)

### Hostgator:
- [ ] Arquivos da landing page (index.html, privacy.html, terms.html) no public_html
- [ ] Pasta images com as logos no lugar certo
- [ ] Landing page acessível em https://opinaja.com.br

### Railway:
- [ ] Domínio customizado app.opinaja.com.br adicionado
- [ ] Variável BASE_URL configurada como https://app.opinaja.com.br
- [ ] Aplicação acessível em https://app.opinaja.com.br

### Testes:
- [ ] Landing page carrega em opinaja.com.br
- [ ] Aplicação carrega em app.opinaja.com.br
- [ ] Links da landing redirecionam para app.opinaja.com.br/login
- [ ] SSL/HTTPS funcionando em ambos domínios

---

## Problemas Comuns e Soluções

### 1. "Este site não pode ser acessado"
**Causa**: DNS ainda não propagou
**Solução**: Aguarde mais tempo (até 48h) ou verifique se configurou corretamente os registros DNS

### 2. "Conexão não é segura" (SSL)
**Causa**: Certificado SSL ainda não foi emitido
**Solução**: Aguarde. A Railway e Hostgator emitem certificados SSL automaticamente (pode levar até 24h)

### 3. Landing page mostra página padrão da Hostgator
**Causa**: O arquivo index.html não está na pasta public_html
**Solução**: Verifique se o arquivo está no lugar certo e se está nomeado como "index.html"

### 4. app.opinaja.com.br não carrega
**Causas possíveis**:
- DNS não propagou ainda
- Registro CNAME/A configurado incorretamente
- Domínio não foi adicionado na Railway

**Solução**:
1. Verifique os registros DNS no cPanel
2. Verifique se o domínio foi adicionado na Railway
3. Aguarde propagação DNS

### 5. Links na landing page não funcionam
**Causa**: Os links ainda apontam para /login em vez de app.opinaja.com.br/login
**Solução**: Verificar se os arquivos HTML foram atualizados corretamente

---

## Arquivos Atualizados para Download

Os arquivos da landing page já foram preparados com os links corretos:
- `landing.html` → Usar como `index.html` na Hostgator
- `privacy.html` → Política de privacidade
- `terms.html` → Termos de uso

**Todos os links já estão atualizados para apontar para app.opinaja.com.br**

---

## Suporte

Se tiver dúvidas durante o processo:
1. Tire screenshots das telas
2. Anote mensagens de erro
3. Verifique cada etapa do checklist

**Boa sorte com a configuração! 🚀**
