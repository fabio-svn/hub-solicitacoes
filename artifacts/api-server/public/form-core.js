/* form-core.js — plumbing compartilhado dos forms do Hub SVN. v3
 * API:
 *   FormCore.initForm({tipo, onReady, draft, redirectPath, activeRoute, stepper})
 *   FormCore.validateRequired(extraValidate, scopeEl)   // scopeEl opcional: limita a um step
 *   FormCore.markInvalid(invalidFields, containerEl, msg)
 *   FormCore.submit({tipo, subtipo, maturidade, dados, files, resumo, btnId})
 *   FormCore.renderStepper(el, steps, current) / attachStepper(el, steps)
 */
window.FormCore = (function () {
  function _bindPageshow() {
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        try { sessionStorage.removeItem('svn_ultimo_resumo'); } catch (_) {}
        window.location.reload();
      }
    });
  }
  // Limpa o estado .field-invalid assim que o usuário corrige o campo.
  // Cobre text/select/textarea (via value) e checkbox/radio (via :checked no grupo).
  function _bindClearInvalid() {
    ['input', 'change'].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        const t = e.target;
        const field = t.closest && t.closest('.field');
        if (!field || !field.classList.contains('field-invalid')) return;
        let corrigido;
        if (t.type === 'checkbox' || t.type === 'radio') {
          corrigido = !!(t.name && document.querySelector('input[name="' + t.name + '"]:checked'));
        } else {
          corrigido = (t.value || '').trim() !== '';
        }
        if (corrigido) field.classList.remove('field-invalid');
      });
    });
  }
  function _popularSetor() {
    const sel = document.getElementById('setor');
    if (sel && typeof SETORES !== 'undefined') {
      SETORES.filter(function (s) { return s !== 'Selecione seu setor'; }).forEach(function (s) {
        const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o);
      });
    }
  }
  function _aplicarPerfil() {
    if (typeof Auth === 'undefined' || !Auth.aplicarPerfilNoCampo) return;
    Auth.aplicarPerfilNoCampo('telefone',   Auth.getTelefone && Auth.getTelefone());
    Auth.aplicarPerfilNoCampo('unidade',    Auth.getUnidade && Auth.getUnidade());
    Auth.aplicarPerfilNoCampo('escritorio', Auth.getEscritorio && Auth.getEscritorio());
    Auth.aplicarPerfilNoCampo('cargo',      Auth.getCargo && Auth.getCargo());
    Auth.aplicarPerfilNoCampo('cdAncord',   Auth.getCdAncord && Auth.getCdAncord());
    Auth.aplicarPerfilNoCampo('email',      Auth.getUserEmail && Auth.getUserEmail());
    Auth.aplicarPerfilNoCampo('nome',       Auth.getUserName && Auth.getUserName());
  }
  function _draftKey(tipo) { return 'form-' + tipo; }
  function _saveDraft(tipo) {
    try {
      const root = document.getElementById('pageContent') || document;
      const blob = {};
      root.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
        if (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return;
        blob[el.id] = el.value;
      });
      sessionStorage.setItem(_draftKey(tipo), JSON.stringify(blob));
    } catch (_) {}
  }
  function _restoreDraft(tipo) {
    try {
      const blob = JSON.parse(sessionStorage.getItem(_draftKey(tipo)) || 'null');
      if (!blob) return;
      Object.keys(blob).forEach(function (id) {
        const el = document.getElementById(id);
        if (el && blob[id] != null && blob[id] !== '') el.value = blob[id];
      });
    } catch (_) {}
  }

  async function initForm(opts) {
    opts = opts || {};
    _bindPageshow();
    _bindClearInvalid();
    if (typeof _configReady !== 'undefined') { try { await _configReady; } catch (_) {} }
    await Auth.init();
    if (!Auth.isAuthenticated()) {
      window.location.href = '/auth/login?redirect=' + encodeURIComponent(opts.redirectPath || location.pathname);
      return false;
    }
    if (typeof Shell !== 'undefined' && Shell.render) {
      Shell.render({ activeRoute: opts.activeRoute || 'nova-solicitacao', contentEl: document.getElementById('pageContent') });
    }
    _popularSetor();
    _aplicarPerfil();
    if (typeof opts.onReady === 'function') { try { await opts.onReady(); } catch (e) { console.error(e); } }
    syncRequiredMarks();   // garante que todo [required] mostre o asterisco
    if (opts.draft && opts.tipo) {
      _restoreDraft(opts.tipo);
      ['input', 'change'].forEach(function (evt) {
        document.addEventListener(evt, function () { _saveDraft(opts.tipo); });
      });
    }
    if (opts.stepper && opts.stepper.el) {
      renderStepper(document.getElementById(opts.stepper.el), opts.stepper.steps || [], opts.stepper.current || 1);
    }
    return true;
  }

  // Helper interno: cria/atualiza o .field-error SEMPRE dentro do wrapper .field (posição única).
  function _setFieldError(wrap, msg) {
    if (!wrap) return;
    wrap.classList.add('field-invalid');
    let err = wrap.querySelector('.field-error');
    if (!err) { err = document.createElement('div'); err.className = 'field-error'; wrap.appendChild(err); }
    err.textContent = msg || 'Este campo é obrigatório.';
  }

  // syncRequiredMarks(scopeEl?) — injeta o asterisco ruby no label de todo .field
  // que contenha um campo [required]. Idempotente (não duplica) e seguro de re-chamar
  // após renders dinâmicos. Fonte da verdade visual = o atributo `required` do HTML.
  function syncRequiredMarks(scopeEl) {
    const root = scopeEl || document;
    root.querySelectorAll('.field').forEach(function (field) {
      if (!field.querySelector('input[required], select[required], textarea[required]')) return;
      // label do próprio campo (filho direto). Fallback: 1º label que não seja de opção.
      let label = field.querySelector(':scope > label');
      if (!label) {
        const labels = field.querySelectorAll('label');
        for (let i = 0; i < labels.length; i++) {
          if (!labels[i].classList.contains('checkbox-option') && !labels[i].classList.contains('radio-option')) {
            label = labels[i]; break;
          }
        }
      }
      if (!label || label.querySelector('.text-ruby')) return;   // sem label ou já marcado
      const span = document.createElement('span');
      span.className = 'text-ruby';
      span.textContent = '*';
      label.appendChild(document.createTextNode(' '));
      label.appendChild(span);
    });
  }

  // validateRequired(extraValidate?, scopeEl?)
  //  - scopeEl: se passado, valida só dentro dele (ex.: um step). Default: document.
  //  - trata checkbox/radio obrigatório (grupo precisa ter ao menos 1 :checked).
  //  - ignora campos dentro de .conditional-fields que não estejam .open (campo oculto).
  function validateRequired(extraValidate, scopeEl) {
    const root = scopeEl || document;
    root.querySelectorAll('.field-invalid').forEach(function (el) { el.classList.remove('field-invalid'); });
    const invalidFields = [];
    const gruposVistos = {};
    root.querySelectorAll('input[required], select[required], textarea[required]').forEach(function (input) {
      const cond = input.closest('.conditional-fields');
      if (cond && !cond.classList.contains('open')) return;   // bloco condicional fechado: não valida
      let vazio;
      if (input.type === 'checkbox' || input.type === 'radio') {
        if (gruposVistos[input.name]) return;           // valida o grupo uma vez só
        gruposVistos[input.name] = true;
        vazio = !root.querySelector('input[name="' + input.name + '"]:checked');
      } else {
        vazio = !(input.value || '').trim();
      }
      if (vazio) {
        const wrap = input.closest('.field');
        if (wrap) { _setFieldError(wrap, 'Este campo é obrigatório.'); invalidFields.push(wrap); }
      }
    });
    if (typeof extraValidate === 'function') { try { extraValidate(invalidFields); } catch (e) { console.error(e); } }
    if (invalidFields.length > 0) { invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  }

  function markInvalid(invalidFields, containerEl, msg) {
    const field = containerEl && containerEl.closest('.field');
    if (field && !field.classList.contains('field-invalid')) {
      _setFieldError(field, msg || 'Campo obrigatório.');
      invalidFields.push(field);
    }
  }

  // submit({tipo, subtipo?, maturidade?, dados, files?, resumo?, btnId?, draftTipo?})
  //  - tipo: tipo_solicitacao enviado ao backend (ex.: 'conteudo-pdf-informativo')
  //  - draftTipo: namespace do rascunho, igual ao tipo do initForm (ex.: 'criacao-pdf').
  //               Default = tipo. Usado só pra limpar o rascunho no sucesso.
  //  - resumo: campos extras mesclados no svn_ultimo_resumo (ex.: titulo, natureza, materiais)
  async function submit(opts) {
    const tipo = opts.tipo;
    const dados = opts.dados || {};
    const btn = document.getElementById(opts.btnId || 'btnSubmit');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; if (window.formLockUI) window.formLockUI(btn); }

    const fd = new FormData();
    fd.append('tipo_solicitacao', tipo);
    if (opts.subtipo != null && opts.subtipo !== '') fd.append('subtipo', opts.subtipo);
    if (opts.maturidade != null && opts.maturidade !== '') fd.append('maturidade', opts.maturidade);
    fd.append('dados', JSON.stringify(dados));
    (opts.files || []).forEach(function (f) {
      const inputId = typeof f === 'string' ? f : f.inputId;
      const field = typeof f === 'string' ? 'arquivo' : (f.field || 'arquivo');
      const multiple = typeof f === 'object' && f.multiple;
      const el = document.getElementById(inputId);
      if (!el || !el.files || !el.files.length) return;
      if (multiple) { for (let i = 0; i < el.files.length; i++) fd.append(field, el.files[i]); }
      else { fd.append(field, el.files[0]); }
    });

    let res = { ok: false }, d = {};
    try {
      res = await fetch('/api/solicitacoes', { method: 'POST', body: fd });
      d = await res.json().catch(function () { return {}; });
    } catch (_) {}

    if (res.ok) {
      try { sessionStorage.removeItem('form-' + (opts.draftTipo || tipo)); } catch (_) {}
      try {
        const baseResumo = {
          tipo_id: tipo,
          tipo: (typeof TIPO_SOLICITACAO_LABELS !== 'undefined' && TIPO_SOLICITACAO_LABELS[tipo]) || tipo,
          solicitante: Auth.getUserName ? Auth.getUserName() : '',
          setor: dados.setor || '',
          data: new Date().toLocaleDateString('pt-BR'),
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          id: d.id,
        };
        sessionStorage.setItem('svn_ultimo_resumo', JSON.stringify(Object.assign(baseResumo, opts.resumo || {})));
      } catch (_) {}
      window.location.replace('/thankyou.html');
      return true;
    }

    const errEl = document.getElementById('submitError');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = d.error || 'Erro ao enviar. Tente novamente.'; }
    if (btn) { if (window.formUnlockUI) window.formUnlockUI(btn); else { btn.disabled = false; btn.textContent = 'Enviar'; } }
    return false;
  }

  function renderStepper(el, steps, current) {
    if (!el || !Array.isArray(steps)) return;
    el.classList.toggle('svn-stepper--compact', steps.length > 4);
    let html = '';
    steps.forEach(function (label, i) {
      const n = i + 1;
      const cls = n < current ? 'is-done' : (n === current ? 'is-active' : '');
      html += '<div class="svn-step ' + cls + '"><span class="svn-step-num">' + (n < current ? '\u2713' : n) + '</span><span class="svn-step-label">' + label + '</span></div>';
      if (i < steps.length - 1) html += '<span class="svn-step-line"></span>';
    });
    el.innerHTML = html;
  }

  function attachStepper(el, steps) {
    if (!el || !Array.isArray(steps)) return;
    const labelEl = document.getElementById('stepLabel');
    function cur() {
      const m = labelEl && (labelEl.textContent || '').match(/(\d+)\s*de\s*\d+/i);
      return m ? parseInt(m[1], 10) : 1;
    }
    function draw() { renderStepper(el, steps, cur()); }
    draw();
    if (labelEl && window.MutationObserver) {
      new MutationObserver(draw).observe(labelEl, { childList: true, characterData: true, subtree: true });
    }
  }

  function _autoSteppers() {
    if (!document.getElementById('stepLabel')) return;
    document.querySelectorAll('.svn-stepper[data-steps]').forEach(function (el) {
      if (el.dataset.stepperReady) return;
      el.dataset.stepperReady = '1';
      attachStepper(el, el.getAttribute('data-steps').split('|'));
    });
  }
  if (typeof document !== 'undefined') {
    var _docObs = window.MutationObserver ? new MutationObserver(_autoSteppers) : null;
    document.addEventListener('DOMContentLoaded', function () {
      _autoSteppers();
      if (_docObs) {
        _docObs.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(function () { _autoSteppers(); _docObs.disconnect(); }, 3000);
      }
    });
    _autoSteppers();
  }

  return { initForm: initForm, validateRequired: validateRequired, syncRequiredMarks: syncRequiredMarks, markInvalid: markInvalid, submit: submit, renderStepper: renderStepper, attachStepper: attachStepper };
})();