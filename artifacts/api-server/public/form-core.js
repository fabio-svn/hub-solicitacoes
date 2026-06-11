/* form-core.js — plumbing compartilhado dos forms do Hub SVN.
 * Mantém o markup de cada form; centraliza auth, validação, submit e sucesso.
 * Uso: FormCore.initForm({tipo, onReady}); FormCore.validateRequired(extra); FormCore.submit({tipo, dados, files}); */
window.FormCore = (function () {
  function _bindPageshow() {
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        try { sessionStorage.removeItem('svn_ultimo_resumo'); } catch (_) {}
        window.location.reload();
      }
    });
  }
  function _bindClearInvalid() {
    document.addEventListener('change', function (e) {
      const field = e.target.closest && e.target.closest('.field');
      if (field && field.classList.contains('field-invalid') && (e.target.value || '').trim()) {
        field.classList.remove('field-invalid');
      }
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
      Shell.render({ activeRoute: 'nova-solicitacao', contentEl: document.getElementById('pageContent') });
    }
    _popularSetor();
    _aplicarPerfil();
    if (typeof opts.onReady === 'function') { try { await opts.onReady(); } catch (e) { console.error(e); } }
    return true;
  }

  function validateRequired(extraValidate) {
    document.querySelectorAll('.field-invalid').forEach(function (el) { el.classList.remove('field-invalid'); });
    const invalidFields = [];
    document.querySelectorAll('input[required], select[required], textarea[required]').forEach(function (input) {
      if (!(input.value || '').trim()) {
        const wrap = input.closest('.field');
        if (wrap) {
          wrap.classList.add('field-invalid');
          let err = wrap.querySelector('.field-error');
          if (!err) { err = document.createElement('div'); err.className = 'field-error'; input.parentElement.appendChild(err); }
          err.textContent = 'Este campo é obrigatório.';
          invalidFields.push(wrap);
        }
      }
    });
    if (typeof extraValidate === 'function') { try { extraValidate(invalidFields); } catch (e) { console.error(e); } }
    if (invalidFields.length > 0) { invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  }

  function markInvalid(invalidFields, containerEl, msg) {
    const field = containerEl && containerEl.closest('.field');
    if (field && !field.classList.contains('field-invalid')) {
      field.classList.add('field-invalid');
      let err = field.querySelector('.field-error');
      if (!err) { err = document.createElement('div'); err.className = 'field-error'; containerEl.parentElement.appendChild(err); }
      err.textContent = msg || 'Campo obrigatório.';
      invalidFields.push(field);
    }
  }

  async function submit(opts) {
    const tipo = opts.tipo;
    const dados = opts.dados || {};
    const btn = document.getElementById(opts.btnId || 'btnSubmit');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; if (window.formLockUI) window.formLockUI(btn); }

    const fd = new FormData();
    fd.append('tipo_solicitacao', tipo);
    fd.append('dados', JSON.stringify(dados));
    (opts.files || []).forEach(function (f) {
      const inputId = typeof f === 'string' ? f : f.inputId;
      const field = typeof f === 'string' ? 'arquivo' : (f.field || 'arquivo');
      const el = document.getElementById(inputId);
      if (el && el.files && el.files[0]) fd.append(field, el.files[0]);
    });

    let res = { ok: false }, d = {};
    try {
      res = await fetch('/api/solicitacoes', { method: 'POST', body: fd });
      d = await res.json().catch(function () { return {}; });
    } catch (_) {}

    if (res.ok) {
      try {
        sessionStorage.setItem('svn_ultimo_resumo', JSON.stringify({
          tipo: (typeof TIPO_SOLICITACAO_LABELS !== 'undefined' && TIPO_SOLICITACAO_LABELS[tipo]) || tipo,
          solicitante: Auth.getUserName ? Auth.getUserName() : '',
          setor: dados.setor || '',
          data: new Date().toLocaleDateString('pt-BR'),
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          id: d.id,
        }));
      } catch (_) {}
      window.location.replace('/thankyou.html');
      return true;
    }

    const errEl = document.getElementById('submitError');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = d.error || 'Erro ao enviar. Tente novamente.'; }
    if (btn) { if (window.formUnlockUI) window.formUnlockUI(btn); else { btn.disabled = false; btn.textContent = 'Enviar'; } }
    return false;
  }

  return { initForm: initForm, validateRequired: validateRequired, markInvalid: markInvalid, submit: submit };
})();
