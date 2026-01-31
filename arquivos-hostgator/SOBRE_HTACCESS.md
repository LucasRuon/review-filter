# Como Funciona o Arquivo .htaccess

## 🎯 O que é?

O arquivo `.htaccess` é um arquivo de configuração do Apache (servidor web da Hostgator) que permite personalizar o comportamento do site.

---

## ✅ O que ele faz neste projeto

### 1. URLs Limpas (sem .html)
```
/privacy → redireciona para privacy.html
/terms → redireciona para terms.html
```

**Benefício**: URLs mais bonitas e profissionais!
- ❌ Antes: `opinaja.com.br/privacy.html`
- ✅ Agora: `opinaja.com.br/privacy`

### 2. Força HTTPS (segurança)
Redireciona automaticamente HTTP para HTTPS

**Benefício**: Seu site sempre será seguro (cadeado verde)
- ❌ `http://opinaja.com.br` → redireciona
- ✅ `https://opinaja.com.br`

### 3. Remove www do domínio
Redireciona www para versão sem www

**Benefício**: URL mais limpa
- ❌ `www.opinaja.com.br` → redireciona
- ✅ `opinaja.com.br`

---

## 📤 Como fazer upload

### O arquivo .htaccess DEVE estar em public_html

1. Acesse o cPanel da Hostgator
2. Vá em **Gerenciador de Arquivos**
3. Entre em **public_html**
4. Faça upload do arquivo `.htaccess`

**IMPORTANTE**:
- O arquivo começa com ponto: `.htaccess`
- Ele pode estar "escondido" no gerenciador de arquivos
- Para ver arquivos ocultos: Clique em **Configurações** → Marque "Mostrar arquivos ocultos"

---

## 🔍 Como verificar se está funcionando

Depois do upload, teste:

1. Acesse: `https://opinaja.com.br/privacy`
   - ✅ Deve carregar a página de privacidade

2. Acesse: `https://opinaja.com.br/terms`
   - ✅ Deve carregar a página de termos

3. Acesse: `http://opinaja.com.br` (sem s)
   - ✅ Deve redirecionar para `https://opinaja.com.br`

4. Acesse: `www.opinaja.com.br`
   - ✅ Deve redirecionar para `opinaja.com.br`

---

## ⚠️ Problemas Comuns

### Erro 500 após upload do .htaccess
**Causa**: Sintaxe errada ou incompatibilidade com o servidor
**Solução**:
1. Delete o arquivo .htaccess
2. Teste se o site volta a funcionar
3. Adicione as regras uma por uma para identificar qual está causando problema

### URLs ainda aparecem com .html
**Causa**: Cache do navegador ou .htaccess não está no lugar certo
**Solução**:
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Verifique se o .htaccess está em public_html
3. Teste em modo anônimo/privado

### Não consigo ver o arquivo .htaccess
**Causa**: Arquivos ocultos não estão sendo exibidos
**Solução**:
1. No gerenciador de arquivos, clique em **Configurações** (ícone de engrenagem)
2. Marque a opção **"Mostrar arquivos ocultos (dotfiles)"**
3. Clique em **Salvar**

---

## 📁 Estrutura Final no Servidor

```
public_html/
├── .htaccess ← ARQUIVO INVISÍVEL (importante!)
├── index.html
├── privacy.html
├── terms.html
└── images/
    ├── logo-dark.png
    ├── logo-icon-dark.png
    └── og-image.png
```

---

## 🎨 Personalizações Opcionais

### Adicionar mais páginas com URLs limpas:
Abra o .htaccess e adicione novas regras:

```apache
# Para /contato → contato.html
RewriteRule ^contato$ contato.html [L]

# Para /sobre → sobre.html
RewriteRule ^sobre$ sobre.html [L]
```

### Remover .html de TODAS as páginas automaticamente:
Adicione esta regra no .htaccess:

```apache
# Remove .html de todas as URLs
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^([^\.]+)$ $1.html [NC,L]
```

---

## ✅ Checklist de Upload

- [ ] Arquivo .htaccess está na pasta public_html
- [ ] Arquivos HTML (index, privacy, terms) estão no lugar
- [ ] Pasta images está no lugar
- [ ] Ativei "Mostrar arquivos ocultos" no gerenciador
- [ ] Testei /privacy e funciona
- [ ] Testei /terms e funciona
- [ ] HTTPS está funcionando
- [ ] www redireciona corretamente

---

## 🎉 Pronto!

Com o .htaccess configurado, seus visitantes terão URLs limpas e profissionais, sempre com HTTPS ativo!

**URLs que funcionam:**
- ✅ `opinaja.com.br`
- ✅ `opinaja.com.br/privacy`
- ✅ `opinaja.com.br/terms`

---

**Dúvidas? Consulte os outros guias ou teste cada configuração isoladamente!**
