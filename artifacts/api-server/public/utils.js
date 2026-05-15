function mascaraTelefone(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 6) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2,7) + '-' + v.substring(7);
  } else if (v.length > 2) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2);
  } else if (v.length > 0) {
    v = '(' + v;
  }
  el.value = v;
}

function mascaraMoeda(el) {
  let v = el.value.replace(/\D/g, '');
  const num = parseInt(v) || 0;
  el.value = (num / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });
}

window.formLockUI = function(btn) {
  if (!btn) return;
  btn._origText = btn.textContent;
  btn.disabled = true;
  const form = btn.closest ? btn.closest('form') : document.querySelector('form');
  if (form) form.querySelectorAll('input, select, textarea').forEach(function(el) { el.disabled = true; });
  const sa = document.getElementById('formStatusArea');
  if (sa) {
    sa.innerHTML = '<div class="form-status form-status-loading"><span class="spinner"></span><span>Gerando sua arte... aguarde</span></div>';
    sa.style.display = 'block';
  }
  const errEl = document.getElementById('submitError');
  if (errEl) errEl.style.display = 'none';
};

window.formUnlockUI = function(btn, errMsg) {
  if (!btn) return;
  const form = btn.closest ? btn.closest('form') : document.querySelector('form');
  if (form) form.querySelectorAll('input, select, textarea').forEach(function(el) { el.disabled = false; });
  btn.disabled = false;
  btn.textContent = btn._origText || 'Enviar';
  const sa = document.getElementById('formStatusArea');
  if (sa) {
    if (errMsg) {
      sa.innerHTML = '<div class="form-status form-status-error"><span>⚠️ Houve um problema ao enviar. Tente novamente ou contate o suporte.</span><small>' + errMsg + '</small></div>';
      sa.style.display = 'block';
    } else {
      sa.style.display = 'none';
    }
  }
};
