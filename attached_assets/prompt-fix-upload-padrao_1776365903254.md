# Padronização — Confirmação de upload de arquivo

O padrão correto é usar `FileUpload.bind()` do `upload-feedback.js`.
Aplicar em todos os forms que ainda usam o padrão antigo (innerHTML inline).

O form-pagina-assessores.html já está correto e serve de referência:
```js
FileUpload.bind('fotoPerfil', 'fotoPerfilName', {
  accept: '.jpg,.jpeg,.png,.webp',
  maxMB: 50
});
```

---

## 1. `form-eventos.html`

### 1a. Substituir o listener inline dos arquivos de upload no `init()`

Remover este bloco do `init()`:
```js
['logoFile','imgFile','demaisFile'].forEach(id => {
  document.getElementById(id).addEventListener('change', e => {
    const f = e.target.files[0];
    const el = document.getElementById(id.replace('File','FileName'));
    el.innerHTML = f ? `<span style="display:flex;...">...</span>` : '';
  });
});
```

Substituir por:
```js
FileUpload.bind('logoFile',    'logoFileName');
FileUpload.bind('imgFile',     'imgFileName');
FileUpload.bind('demaisFile',  'demaisFileName');
```

### 1b. Substituir os listeners de foto dos palestrantes em `showPalFields()`

Dentro de `showPalFields(i, isSvn)`, remover o bloco:
```js
const fotoInput = document.getElementById('palFoto' + i);
const statusEl = document.getElementById('palFotoStatus' + i);
if (fotoInput) {
  fotoInput.addEventListener('change', function() {
    // ... lógica inline de FileReader e innerHTML ...
  });
}
```

Substituir por:
```js
FileUpload.bind('palFoto' + i, 'palFotoStatus' + i, {
  accept: '.jpg,.jpeg,.png,.webp',
  maxMB: 50,
  onChange: function(file) {
    // Atualizar preview do palestrante com a foto
    const reader = new FileReader();
    reader.onload = function(e) {
      const avatarEl = document.querySelector('#palPreview' + i + ' .speaker-avatar');
      if (avatarEl) {
        avatarEl.innerHTML = `<img src="${e.target.result}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }
    };
    reader.readAsDataURL(file);
  }
});
```

### 1c. Verificar que `upload-feedback.js` está importado no `<head>`
```html
<script src="upload-feedback.js"></script>
```
Adicionar antes de `<script src="config.js"></script>` se não existir.

---

## 2. `form-artes-divulgacao.html`

Já usa `FileUpload.bind('arquivoApoio', 'arquivoApoioName')` ✅
Nenhuma alteração necessária.

---

## 3. `form-atualizacao-material.html`

Já usa `FileUpload.bind('materialAtual', 'materialAtualName')` ✅
Nenhuma alteração necessária.

---

## 4. `form-apresentacoes.html`

### 4a. Substituir os listeners inline dos uploads no `init()`

Remover este bloco:
```js
['arquivoBase', 'arquivoBaseNova', 'arquivoApoio'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', e => {
    const f = e.target.files[0];
    const nameEl = document.getElementById(id + 'Name');
    if (!nameEl) return;
    nameEl.innerHTML = f ? `<span style="display:flex;...">...</span>` : '';
  });
});
```

Substituir por:
```js
FileUpload.bind('arquivoBase',     'arquivoBaseName',     { accept: '.pptx,.pdf,.key' });
FileUpload.bind('arquivoBaseNova', 'arquivoBaseNovaName', { accept: '.pptx,.pdf,.key' });
FileUpload.bind('arquivoApoio',    'arquivoApoioName');
```

### 4b. Verificar que `upload-feedback.js` está importado
```html
<script src="upload-feedback.js"></script>
```

---

## 5. `form-criacao-pdf.html`

### 5a. Substituir o listener inline do upload no `init()`

Remover:
```js
document.getElementById('arquivoApoio').addEventListener('change', e => {
  const f = e.target.files[0];
  const el = document.getElementById('arquivoApoioName');
  el.innerHTML = f ? `<span style="display:flex;...">...</span>` : '';
});
```

Substituir por:
```js
FileUpload.bind('arquivoApoio', 'arquivoApoioName');
```

### 5b. Verificar que `upload-feedback.js` está importado
```html
<script src="upload-feedback.js"></script>
```

---

## OBSERVAÇÕES

- O `upload-feedback.js` já está sendo importado em `form-artes-divulgacao.html`
  e `form-atualizacao-material.html` — confirmar que está presente nos demais
- O `FileUpload.bind()` já cuida de: exibir nome do arquivo, tamanho, ícone de check
  verde, validação de extensão (se `accept` fornecido) e validação de tamanho (se
  `maxMB` fornecido) — não precisa de nenhum código adicional
- O elemento `<div class="file-name" id="...Name">` já deve existir no HTML de cada
  campo — é onde o feedback é renderizado. Se não existir, adicionar abaixo do
  `<input type="file">`:
  ```html
  <div class="file-name" id="arquivoApoioName"></div>
  ```
