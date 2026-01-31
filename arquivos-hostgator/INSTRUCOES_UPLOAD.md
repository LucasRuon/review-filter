# Instruções de Upload - Hostgator

## 📤 Como fazer upload dos arquivos

### Passo 1: Acessar o Gerenciador de Arquivos
1. Faça login no **cPanel** da Hostgator
2. Procure por "**Gerenciador de Arquivos**" ou "**File Manager**"
3. Clique para abrir

### Passo 2: Navegar até a pasta correta
1. No gerenciador de arquivos, você verá uma árvore de pastas à esquerda
2. Clique em **public_html**
3. Esta é a pasta raiz do seu site

### Passo 3: Limpar arquivos antigos (se houver)
Se você ver arquivos como:
- index.html (da Hostgator)
- default.html
- Qualquer outro arquivo de exemplo

**Você pode deletá-los**:
1. Selecione o arquivo
2. Clique em "Delete" ou "Excluir"
3. Confirme

### Passo 4: Fazer upload dos arquivos
1. Dentro da pasta **public_html**, clique em **Upload** (geralmente no topo)
2. Uma nova aba/janela abrirá
3. Clique em "Selecionar Arquivo" ou arraste os arquivos:
   - **index.html**
   - **privacy.html**
   - **terms.html**

4. Aguarde o upload completar (barra de progresso chegará a 100%)

### Passo 5: Fazer upload da pasta de imagens
Existem duas formas:

#### Opção A: Upload direto da pasta (Recomendado)
1. Na janela de upload, selecione a pasta **images** completa
2. O cPanel fará upload de toda a pasta com as imagens dentro

#### Opção B: Criar pasta e fazer upload das imagens
1. Volte para o gerenciador de arquivos
2. Dentro de public_html, clique em "**+ Pasta**" ou "**New Folder**"
3. Nome da pasta: `images`
4. Clique em "Criar"
5. **Entre** na pasta images (clique duplo)
6. Clique em Upload
7. Selecione TODAS as imagens de dentro da pasta images:
   - logo-dark.png
   - logo-icon-dark.png
   - og-image.png (se houver)

### Passo 6: Verificar a estrutura final
Volte para public_html e verifique se está assim:

```
public_html/
├── index.html ✅
├── privacy.html ✅
├── terms.html ✅
└── images/
    ├── logo-dark.png ✅
    ├── logo-icon-dark.png ✅
    └── og-image.png ✅
```

### Passo 7: Testar
1. Abra uma nova aba do navegador
2. Digite: `https://opinaja.com.br` (ou `http://opinaja.com.br`)
3. A landing page deve carregar!

---

## ⚠️ Problemas Comuns

### "Página não encontrada" ou "404"
**Causa**: O arquivo index.html não está na pasta public_html
**Solução**:
1. Verifique se o arquivo está em public_html (não em uma subpasta)
2. Verifique se o nome está correto: `index.html` (tudo minúsculo)

### Imagens não aparecem
**Causa**: A pasta images não está em public_html ou as imagens não foram enviadas
**Solução**:
1. Verifique se existe uma pasta chamada "images" dentro de public_html
2. Entre na pasta images e verifique se as imagens estão lá

### Ainda aparece a página padrão da Hostgator
**Causa**: Pode haver um arquivo index.html antigo ou cache do navegador
**Solução**:
1. Delete qualquer index.html antigo
2. Faça upload do seu index.html novamente
3. Limpe o cache do navegador (Ctrl+Shift+Delete)
4. Tente em modo anônimo/privado

---

## ✅ Checklist de Upload

- [ ] Arquivos HTML estão em public_html (não em subpasta)
- [ ] Pasta images está em public_html
- [ ] Imagens estão dentro da pasta images
- [ ] Nomes dos arquivos estão corretos (sem espaços, tudo minúsculo)
- [ ] Landing page carrega em opinaja.com.br

---

## 🎯 Próximos Passos

Depois do upload bem-sucedido:
1. Configurar DNS para app.opinaja.com.br
2. Configurar Railway
3. Aguardar propagação

Consulte: **GUIA_RAPIDO.md** ou **GUIA_CONFIGURACAO_DOMINIO.md**

---

**Qualquer dúvida, revise os passos acima antes de prosseguir! 👍**
