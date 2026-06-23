const FileUpload = {
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

      if (options.maxMB && f.size > options.maxMB * 1024 * 1024) {
        FileUpload.error(nameEl, 'Arquivo excede o tamanho máximo de ' + options.maxMB + ' MB');
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
  var files = input.files;
  if (!files || !files.length) { FileUpload.clear(nameEl); return; }
  if (files.length === 1) { FileUpload.success(nameEl, files[0]); }
  else {
    nameEl.innerHTML = '<div class="upload-feedback upload-feedback--success">' +
      '<span class="upload-feedback__name">' + files.length + ' arquivos selecionados</span></div>';
  }
});

