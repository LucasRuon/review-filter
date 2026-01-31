# 🚂 Dicas Específicas - Railway

## Como configurar o domínio customizado na Railway

### Passo 1: Acessar o projeto
1. Vá em [railway.app](https://railway.app)
2. Faça login
3. Clique no projeto **Opina Já!** (ou o nome que você deu)

### Passo 2: Localizar a opção de domínios
Na Railway, a interface pode variar, mas geralmente você encontra em um destes lugares:

**Opção A** (mais comum):
1. Clique no **serviço/service** do projeto (geralmente tem um nome como "web" ou o nome do repo)
2. Vá na aba **Settings** (configurações)
3. Role até encontrar **Domains** ou **Networking**
4. Você verá "Domains" com um botão **Generate Domain** ou **Custom Domain**

**Opção B**:
1. Na página principal do projeto
2. Procure por **Custom Domain** no menu lateral
3. Ou procure um ícone de "🌐" ou "link"

### Passo 3: Adicionar domínio customizado

1. Clique em **Custom Domain** ou **Add Domain**
2. Digite: `app.opinaja.com.br`
3. Pressione Enter ou clique em Add

### Passo 4: Copiar informações DNS

Após adicionar o domínio, a Railway mostrará instruções. Você verá algo assim:

#### Exemplo 1 - CNAME (mais comum):
```
Add a CNAME record for app.opinaja.com.br pointing to:
seu-projeto-xxxxx.up.railway.app
```

**O que copiar:**
- Nome do destino: `seu-projeto-xxxxx.up.railway.app`

#### Exemplo 2 - Registro A (menos comum):
```
Add an A record for app.opinaja.com.br pointing to:
64.23.xxx.xxx
```

**O que copiar:**
- O endereço IP: `64.23.xxx.xxx`

### Passo 5: Status do domínio

Depois de configurar o DNS na Hostgator, volte à Railway e veja o status:

- 🔴 **Pending** ou **Waiting** - Aguardando propagação DNS
- 🟡 **Provisioning** - Configurando certificado SSL
- 🟢 **Active** ou **Ready** - Tudo pronto!

---

## 🔧 Configurar Variáveis de Ambiente

### O que é?
Variáveis de ambiente são configurações que a aplicação usa. Precisamos atualizar a URL base.

### Como fazer:

1. No projeto na Railway, vá em **Variables** ou **Environment Variables**
2. Procure se já existe uma variável chamada `BASE_URL`

**Se já existir:**
1. Clique para editar
2. Altere o valor para: `https://app.opinaja.com.br`
3. Salve

**Se NÃO existir:**
1. Clique em **New Variable** ou **Add Variable**
2. Name (Nome): `BASE_URL`
3. Value (Valor): `https://app.opinaja.com.br`
4. Salve

### O que acontece depois:
- A Railway reiniciará a aplicação automaticamente
- Isso leva cerca de 30-60 segundos
- Você verá logs de "Building" e "Deploying"

---

## 📊 Verificar Logs

Se quiser ver o que está acontecendo:

1. No projeto, vá em **Deployments** ou **Logs**
2. Você verá os logs em tempo real
3. Procure por erros (linhas em vermelho)

**Logs normais:**
- ✅ "Server running on port 3000"
- ✅ "Database connected"
- ✅ "Listening on..."

**Logs de problema:**
- ❌ "Error connecting to database"
- ❌ "Port already in use"
- ❌ Qualquer linha com "ERROR" ou "FAIL"

---

## 🌐 Domínio Padrão da Railway

Além do domínio customizado, a Railway cria um domínio padrão como:
- `seu-projeto-production.up.railway.app`

**Você pode:**
- Manter os dois (recomendado temporariamente)
- Remover o domínio padrão depois que confirmar que o customizado funciona

**Como remover** (opcional, faça só depois de tudo funcionando):
1. Em **Domains**
2. Clique no "x" ou "remove" no domínio padrão
3. Confirme

---

## 🔒 Certificado SSL

A Railway configura SSL automaticamente para domínios customizados.

**Processo:**
1. Você adiciona o domínio
2. Configura o DNS
3. Railway detecta o DNS
4. Railway emite certificado SSL (Let's Encrypt)
5. HTTPS funciona! 🎉

**Tempo:** Geralmente 5-30 minutos após o DNS propagar

**Problemas:**
- Se após 24h ainda não tiver SSL, verifique o DNS
- Certifique-se de que o registro CNAME/A está correto

---

## 🎯 Exemplo Visual de Como Fica

### Antes da configuração:
```
Domínios:
└── seu-projeto-production.up.railway.app ✅
```

### Depois da configuração:
```
Domínios:
├── seu-projeto-production.up.railway.app ✅
└── app.opinaja.com.br ✅ (Custom Domain)
    └── SSL: Active 🔒
```

---

## 🚨 Problemas Comuns na Railway

### 1. "Domain already in use"
**Causa:** O domínio já foi adicionado em outro projeto
**Solução:**
- Verifique se você não adicionou em outro projeto
- Ou se outra pessoa da equipe já adicionou

### 2. "Unable to verify domain"
**Causa:** DNS não propagou ainda ou está configurado errado
**Solução:**
- Verifique o DNS no cPanel da Hostgator
- Aguarde mais tempo (até 48h)
- Use [whatsmydns.net](https://whatsmydns.net) para verificar

### 3. Aplicação não inicia após adicionar domínio
**Causa:** Algum erro no código ou variável de ambiente
**Solução:**
- Verifique os logs
- Certifique-se de que BASE_URL está correto

---

## ✅ Checklist Railway

- [ ] Projeto criado e rodando
- [ ] Domínio customizado app.opinaja.com.br adicionado
- [ ] Informações DNS copiadas (CNAME ou IP)
- [ ] Variável BASE_URL configurada
- [ ] Status do domínio: Active/Ready
- [ ] SSL ativo (cadeado verde)
- [ ] Aplicação acessível em app.opinaja.com.br

---

## 💡 Dica Final

**NÃO remova o domínio padrão da Railway** até ter certeza absoluta de que o domínio customizado está funcionando perfeitamente. Use o domínio padrão como backup durante a configuração.

---

**Pronto! Com essas dicas você configurará a Railway sem problemas! 🚀**
