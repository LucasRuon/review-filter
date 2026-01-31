# Atualização: Redirecionamento app.opinaja.com.br → /login

## ✅ Alteração Realizada

**Arquivo modificado:** `server.js`

**O que mudou:**
- ❌ Antes: `app.opinaja.com.br` → Mostrava landing page
- ✅ Agora: `app.opinaja.com.br` → Redireciona para `/login`

---

## 📝 Detalhes da Mudança

### Código Anterior (linhas 448-474):
```javascript
// Serve HTML pages - COM CACHE
app.get('/', async (req, res) => {
    try {
        const now = Date.now();
        // ... carregava landing page
        res.send(landingPageCache);
    } catch (error) {
        res.sendFile(path.join(__dirname, 'views', 'landing.html'));
    }
});
```

### Código Novo:
```javascript
// Redirecionar rota raiz para login
app.get('/', (req, res) => {
    res.redirect('/login');
});
```

**Simplificado e direto!** ✨

---

## 🚀 Como Fazer Deploy

### Opção 1: Git + Railway (Recomendado)

```bash
# 1. Ir para a pasta do projeto
cd /Users/lucasruon/Downloads/review-filter

# 2. Verificar status
git status

# 3. Adicionar as mudanças
git add server.js

# 4. Fazer commit
git commit -m "Redirecionar app.opinaja.com.br para /login"

# 5. Fazer push
git push origin main
```

**A Railway fará deploy automaticamente!** 🎉

---

### Opção 2: Sem Git (Upload Direto - NÃO RECOMENDADO)

Se não estiver usando Git com a Railway:
1. Acesse o painel da Railway
2. Faça upload manual do `server.js` atualizado
3. Reinicie a aplicação

---

## ⏱️ Tempo de Deploy

- **Tempo de build**: 1-2 minutos
- **Tempo de deploy**: 30-60 segundos
- **Total**: ~2-3 minutos

---

## ✅ Como Testar

Após o deploy:

### Teste 1: Raiz redireciona para login
```
Acessar: https://app.opinaja.com.br
Resultado: Redireciona automaticamente para https://app.opinaja.com.br/login
```

### Teste 2: Login funciona normalmente
```
Acessar: https://app.opinaja.com.br/login
Resultado: Mostra tela de login
```

### Teste 3: Outras rotas funcionam
```
Acessar: https://app.opinaja.com.br/register
Resultado: Mostra tela de registro
```

---

## 📋 Checklist de Deploy

- [ ] Código alterado em `server.js`
- [ ] Fazer commit no Git
- [ ] Fazer push para o repositório
- [ ] Railway detecta mudanças automaticamente
- [ ] Aguardar build + deploy (2-3 min)
- [ ] Verificar logs na Railway (sem erros)
- [ ] Testar `app.opinaja.com.br` → redireciona para `/login`
- [ ] Testar login funciona normalmente
- [ ] Tudo funcionando! 🎉

---

## 🎯 Resultado Final

```
Fluxo Completo:
═══════════════════════════════════════════════

1. Usuário digita: app.opinaja.com.br
2. Navegador acessa: https://app.opinaja.com.br
3. Servidor responde: Redirect 302 → /login
4. Navegador vai para: https://app.opinaja.com.br/login
5. Usuário vê: Tela de login ✅
```

---

## 💡 Observação

**Landing Page:**
- Está hospedada na Hostgator: `opinaja.com.br`
- Não foi afetada por esta mudança
- Continua acessível normalmente

**App:**
- Hospedado na Railway: `app.opinaja.com.br`
- Agora redireciona `/` para `/login`
- Todas as outras rotas funcionam normalmente

---

## 🆘 Se algo der errado

### Problema: Deploy falhou
**Solução:**
1. Verifique os logs na Railway
2. Procure por erros de sintaxe
3. Se necessário, reverta o commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

### Problema: Ainda mostra landing page
**Solução:**
1. Aguarde o deploy completar (3-5 min)
2. Limpe o cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)
3. Teste em modo anônimo
4. Verifique os logs da Railway

---

**Pronto para fazer o deploy? É só seguir o Passo a Passo acima! 🚀**
