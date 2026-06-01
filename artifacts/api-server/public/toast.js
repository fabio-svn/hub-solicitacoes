// Toast — notificação não bloqueante
window.showToast = function(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('fade-out'), duration - 500);
  setTimeout(() => toast.remove(), duration);
};

// Confirm — modal de confirmação, retorna Promise<boolean>
window.showConfirm = function(message, options = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true">
        <p class="confirm-message">${(message || '').replace(/</g, '&lt;')}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary confirm-cancel">${options.cancelLabel || 'Cancelar'}</button>
          <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'} confirm-ok">${options.okLabel || 'Confirmar'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', onKey);

    setTimeout(() => overlay.querySelector('.confirm-ok').focus(), 50);
  });
};
