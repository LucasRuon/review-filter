# Guia Rápido - Configuração Opina Já!

## 📋 Resumo
- **opinaja.com.br** → Landing Page (Hostgator)
- **app.opinaja.com.br** → Aplicação (Railway)

---

## 🚀 Passo a Passo Rápido

### 1️⃣ RAILWAY - Adicionar Domínio (5 min)
1. Acesse [railway.app](https://railway.app)
2. Entre no projeto Opina Já
3. Vá em **Settings** → **Domains**
4. Clique em **Add Domain**
5. Digite: `app.opinaja.com.br`
6. **COPIE** as informações DNS que aparecerem (CNAME ou IP)

---

### 2️⃣ HOSTGATOR - Configurar DNS (10 min)

#### A) Criar Subdomínio
1. cPanel → **Subdomínios**
2. Subdomínio: `app`
3. Domínio: `opinaja.com.br`
4. Criar

#### B) Configurar DNS para Railway
1. cPanel → **Zonas DNS** (ou Zone Editor)
2. Localize: `opinaja.com.br`
3. Adicione o registro que a Railway forneceu:

**Se Railway forneceu CNAME:**
```
Tipo: CNAME
Nome: app
Destino: seu-projeto.up.railway.app
```

**Se Railway forneceu IP:**
```
Tipo: A
Nome: app
Destino: XXX.XXX.XXX.XXX
```

---

### 3️⃣ HOSTGATOR - Upload da Landing (5 min)
1. cPanel → **Gerenciador de Arquivos**
2. Navegue até: `public_html`
3. Faça upload de TODOS os arquivos da pasta `arquivos-hostgator`:
   - ✅ index.html
   - ✅ privacy.html
   - ✅ terms.html
   - ✅ pasta images/

---

### 4️⃣ RAILWAY - Configurar Variável (2 min)
1. No projeto Railway
2. Vá em **Variables**
3. Adicione ou edite:
   - Nome: `BASE_URL`
   - Valor: `https://app.opinaja.com.br`
4. Salvar (app reiniciará automaticamente)

---

### 5️⃣ AGUARDAR E TESTAR (1-2 horas)
Aguarde a propagação DNS (15 min - 48h, geralmente 1-2h)

**Testes:**
- ✅ https://opinaja.com.br → Landing page carrega?
- ✅ https://app.opinaja.com.br → Aplicação carrega?
- ✅ Botões "Entrar" e "Criar conta" redirecionam para app.opinaja.com.br?

---

## 🔍 Verificar Propagação DNS
- Site: [whatsmydns.net](https://www.whatsmydns.net)
- Digite: `app.opinaja.com.br`
- Tipo: CNAME (ou A)

---

## ⚠️ Problemas?

### DNS não propagou
→ Aguarde mais tempo (até 48h)

### SSL não funciona
→ Aguarde. Certificados são emitidos automaticamente (até 24h)

### Landing mostra página padrão Hostgator
→ Verifique se index.html está em public_html

### app.opinaja.com.br não carrega
→ Verifique:
1. Domínio adicionado na Railway?
2. DNS configurado corretamente no cPanel?
3. DNS já propagou?

---

## 📁 Localização dos Arquivos
- **Guia Completo**: `GUIA_CONFIGURACAO_DOMINIO.md`
- **Arquivos para Upload**: pasta `arquivos-hostgator/`
- **Instruções de Upload**: `arquivos-hostgator/LEIA-ME.txt`

---

## ✅ Checklist Final
- [ ] Domínio app.opinaja.com.br adicionado na Railway
- [ ] Informações DNS copiadas da Railway
- [ ] Subdomínio app criado na Hostgator
- [ ] Registro CNAME/A configurado no DNS
- [ ] Arquivos da landing enviados para public_html
- [ ] Variável BASE_URL configurada na Railway
- [ ] DNS propagado (verificado)
- [ ] Landing carrega em opinaja.com.br
- [ ] App carrega em app.opinaja.com.br
- [ ] Links funcionam corretamente

---

**🎉 Pronto! Seu sistema está no ar!**
