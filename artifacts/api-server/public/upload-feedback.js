const FileUpload = {
  // Espelha o LIMITE_UPLOAD_MB do src/routes/forms.ts. Se mudar la, mude aqui:
  // e este numero que evita um upload longo terminar em recusa.
  MAX_MB_PADRAO: 250,

  // MAX_MB_FOTO: limite unico para campos de FOTO. Fotos reais nao passam disto;
  // padroniza os antigos 5/10/50. Mude AQUI para mudar em todos.
  MAX_MB_FOTO: 25,

  // DICA-COMPARTILHADA: monta "JPG, PNG · até N MB" a partir de accept+maxMB.
  // Usada pelo bind explicito E pelo safety-net, para todo input file ter dica.
  escreverDica(input, options, nameEl) {
    options = options || {};
    var caixa = (input.closest && input.closest('.file-input-wrapper')) || input.parentElement;
      var caixa = (input.closest && input.closest('.file-input-wrapper')) || input.parentElement;
      if (!caixa || caixa.querySelector('.file-hint')) return;

      var partes = [];
      if (options.accept) {
        var itens = options.accept.split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
        // Hoje os formularios so usam extensao, mas aceitar padrao MIME e legal
        // e alguem pode escrever "image/*" um dia — sem isto, a dica omitiria
        // metade do que o campo aceita.
        var GRUPO = { image: 'imagens', video: 'vídeos', audio: 'áudios' };
        var exts = itens.map(function (x) {
          if (x.indexOf('/') === -1) return x.replace(/^\./, '');
          if (x.slice(-2) === '/*') return GRUPO[x.slice(0, -2)] || x.slice(0, -2);
          return x.split('/')[1];
        }).filter(Boolean);
        // "JPG, JPEG" polui sem informar: quem tem .jpeg entende JPG.
        if (exts.indexOf('jpg') !== -1) {
          exts = exts.filter(function (x) { return x !== 'jpeg'; });
        }
        if (exts.length) {
          var GRUPOS = ['imagens', 'vídeos', 'áudios'];
          partes.push(exts.map(function (x) {
            return GRUPOS.indexOf(x) !== -1 ? x : x.toUpperCase();
          }).join(', '));
        }
        // De quebra, o seletor do sistema passa a filtrar sozinho.
        if (!input.getAttribute('accept')) input.setAttribute('accept', options.accept);
      }

      var maxMB = options.maxMB || FileUpload.MAX_MB_PADRAO;
      if (maxMB) partes.push('até ' + maxMB + ' MB');
      if (!partes.length) return;

      var dica = document.createElement('div');
      dica.className = 'file-hint';
      dica.textContent = partes.join(' · ');

      /* DICA-EM-LINHA-FLEX: no formulario de assessores o wrapper divide uma
         linha flex com o botao "Acessar banco de fotos", e o pai alinha pelo
         centro. Pondo a dica DENTRO do wrapper, ele ficava mais alto e o botao
         vizinho descia junto — o alinhamento quebrava. Nesse caso a dica vai
         para o fim da propria linha e, com flex-basis:100% no CSS, cai sozinha
         na linha de baixo: a altura do wrapper volta a ser a do botao. */
      var pai = caixa.parentElement;
      var paiEhFlex = false;
      try {
        paiEhFlex = !!pai && /flex/.test(window.getComputedStyle(pai).display);
      } catch (e) { /* ambiente sem layout: segue pelo caminho normal */ }

      if (paiEhFlex) pai.appendChild(dica);
      // Antes do nome do arquivo escolhido, para a dica ficar colada no botao.
      else if (nameEl && nameEl.parentNode === caixa) caixa.insertBefore(dica, nameEl);
      else caixa.appendChild(dica);
  },

  success(nameEl, file) {
    if (!nameEl) return;
    const size = file.size >= 1024 * 1024
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : Math.round(file.size / 1024) + ' KB';
    nameEl.innerHTML =
      `<div class="upload-feedback upload-feedback--success">` +
        `<svg class="upload-feedback__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>` +
        `<span class="upload-feedback__name" title="${file.name}">${file.name}</span>` +
        `<span class="upload-feedback__meta">${size}</span>` +
      `</div>`;
  },

  error(nameEl, message) {
    if (!nameEl) return;
    nameEl.innerHTML =
      `<div class="upload-feedback upload-feedback--error">` +
        `<svg class="upload-feedback__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` +
        `<span>${message}</span>` +
      `</div>`;
  },

  clear(nameEl) {
    if (!nameEl) return;
    nameEl.innerHTML = '';
  },

  bind(inputId, nameElId, options) {
    const input   = typeof inputId  === 'string' ? document.getElementById(inputId)  : inputId;
    const nameEl  = typeof nameElId === 'string' ? document.getElementById(nameElId) : nameElId;
    if (!input) return;
    if (input.dataset.uploadBound === '1') return;
    input.dataset.uploadBound = '1';
    options = options || {};

    /* DICA-DE-UPLOAD: montada por FileUpload.escreverDica (abaixo), chamada tanto
       aqui (bind explicito) quanto no safety-net por delegacao — assim inputs sem
       bind proprio (ex.: forms de Capital Humano) tambem ganham a dica. */
    FileUpload.escreverDica(input, options, nameEl);
    input.addEventListener('change', function(e) {
      const f = e.target.files[0];
      if (!f) { FileUpload.clear(nameEl); return; }

      if (options.accept) {
        const allowed = options.accept.split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean);
        const ext = f.name.split('.').pop().toLowerCase();
        const mime = f.type.toLowerCase();
        const valid = allowed.some(function(a) {
          if (a === mime) return true;
          if (a.endsWith('/*') && mime.startsWith(a.replace('/*', '/'))) return true;
          return a.replace(/^\./, '') === ext;
        });
        if (!valid) {
          const extLabels = allowed
            .filter(function(a) { return !a.includes('/'); })
            .map(function(x) { return x.replace(/^\./, '').toUpperCase(); });
          FileUpload.error(nameEl, 'Formato não permitido.' + (extLabels.length ? ' Use: ' + extLabels.join(', ') : ''));
          input.value = '';
          return;
        }
      }

      /* MAX_MB_PADRAO: o maxMB era opcional e quase nenhum formulario passava —
         o arquivo subia inteiro para o servidor recusar no fim (14 s de upload
         para receber "erro interno"). Agora, sem maxMB proprio, vale o mesmo
         limite do POST /api/solicitacoes, e a recusa acontece na hora de
         escolher o arquivo. Quem passa um limite menor continua com o seu. */
      var maxMB = options.maxMB || FileUpload.MAX_MB_PADRAO;
      if (maxMB && f.size > maxMB * 1024 * 1024) {
        FileUpload.error(nameEl, 'Arquivo excede o tamanho máximo de ' + maxMB + ' MB');
        input.value = '';
        return;
      }

      FileUpload.success(nameEl, f);
      if (options.onChange) options.onChange(f, nameEl, input);
    });
  }
};

/* Safety-net: feedback de upload por delegação no document (à prova de timing).
   Cobre qualquer input[type=file] com id cujo feedback seja o elemento `<id>Name`.
   Defere a binds explícitos (FileUpload.bind marca dataset.uploadBound='1') para não duplicar. */
document.addEventListener('change', function (e) {
  var input = e.target;
  if (!input || input.tagName !== 'INPUT' || input.type !== 'file' || !input.id) return;
  if (input.dataset.uploadBound === '1') return;
  var nameEl = document.getElementById(input.id + 'Name');
  if (!nameEl || typeof FileUpload === 'undefined') return;
  // Sem bind proprio, a dica nunca era montada. Monta agora (uma vez), lendo o
  // accept do proprio input se houver. Assim os forms de Capital Humano (input
  // file solto) ganham "até 25 MB" como os demais.
  if (FileUpload.escreverDica) {
    var accAttr = input.getAttribute('accept');
    FileUpload.escreverDica(input, { accept: accAttr || '' }, nameEl);
  }
  var files = input.files;
  if (!files || !files.length) { FileUpload.clear(nameEl); return; }
  if (files.length === 1) { FileUpload.success(nameEl, files[0]); }
  else {
    nameEl.innerHTML = '<div class="upload-feedback upload-feedback--success">' +
      '<span class="upload-feedback__name">' + files.length + ' arquivos selecionados</span></div>';
  }
});

