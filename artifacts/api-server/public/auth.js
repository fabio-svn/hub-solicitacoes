const Auth = {
  user: null,
  profile: null,
  initialized: false,
  _outsideClickListenerAdded: false,
  _pendenteIds: new Set(),

  getProfile() { return this.profile; },
  getTelefone() { return this.profile?.telefone || ''; },
  getUnidade() { return this.profile?.unidade || ''; },
  getEscritorio() { return this.profile?.escritorio || ''; },
  getCargo() { return this.profile?.cargo || ''; },
  getCdAncord() { return this.profile?.cd_ancord || ''; },
  perfilEncontrado() { return !!this.profile?.encontrado; },

  async refreshProfile() {
    try {
      const res = await fetch('/auth/me-profile/refresh', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        this.profile = d.profile || null;
      }
    } catch {}
    return this.profile;
  },

  aplicarPerfilNoCampo(fieldId, valor) {
    const el = document.getElementById(fieldId);
    if (!el || !valor) return false;
    if (el.tagName === 'SELECT') {
      let achou = false;
      for (const opt of el.options) { if (opt.value === valor || opt.textContent === valor) { achou = true; break; } }
      if (!achou) {
        const opt = document.createElement('option');
        opt.value = valor; opt.textContent = valor; opt.selected = true;
        el.appendChild(opt);
      }
    }
    el.value = valor;
    const wrap = el.closest('.field');
    if (wrap && !wrap.querySelector('.field-perfil-hint')) {
      const hint = document.createElement('div');
      hint.className = 'field-perfil-hint';
      hint.style.cssText = 'font-size:0.74rem;opacity:0.6;margin-top:4px;display:flex;align-items:center;gap:4px;color:var(--carbon-black,#221b19)';
      hint.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Pré-preenchido do seu cadastro — pode editar se quiser
      `;
      wrap.appendChild(hint);
    }
    return true;
  },

  _getLidos() {
    try { return new Set(JSON.parse(localStorage.getItem('svn_lidos_aprovacao') || '[]')); } catch { return new Set(); }
  },

  marcarComoLido(id) {
    const lidos = this._getLidos();
    if (!lidos.has(id)) {
      lidos.add(id);
      try { localStorage.setItem('svn_lidos_aprovacao', JSON.stringify([...lidos])); } catch {}
    }
    this._pendenteIds.delete(id);
    this._atualizarBadgeHeader();
  },

  temPendencias() {
    const lidos = this._getLidos();
    return [...this._pendenteIds].some(id => !lidos.has(id));
  },

  _atualizarBadgeHeader() {
    const lidos = this._getLidos();
    const naoLidos = [...this._pendenteIds].filter(id => !lidos.has(id));
    const count = naoLidos.length;
    const badge = document.getElementById('notifBadgeAvatar');
    const badgeMenu = document.getElementById('notifBadgeMenu');
    if (badge) { badge.style.display = count > 0 ? '' : 'none'; badge.textContent = count > 9 ? '9+' : String(count); }
    if (badgeMenu) { badgeMenu.style.display = count > 0 ? '' : 'none'; }
  },

  async init() {
    if (this.initialized) return this.user;
    try {
      const res = await fetch("/auth/me");
      if (res.status === 401) {
        this.user = null;
        this.initialized = true;
        return null;
      }
      const data = await res.json();
      if (data.authenticated) {
        this.user = data.user;
        this.profile = data.profile || null;
        if (!this.profile) {
          try {
            const pr = await fetch('/auth/me-profile');
            if (pr.ok) {
              const pd = await pr.json();
              this.profile = pd.profile || null;
            }
          } catch {}
        }
      }
      if (data.impersonating && !sessionStorage.getItem('svn_impersonate')) {
        sessionStorage.setItem('svn_impersonate', data.user.email);
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    } finally {
      this.initialized = true;
    }

    if (this.user) {
      try {
        const pr = await fetch('/api/solicitacoes/pendentes-aprovacao');
        if (pr.ok) {
          const pd = await pr.json();
          this._pendenteIds = new Set(pd.ids || []);
        }
      } catch {}
    }

    // Verificar e exibir banner de impersonação
    const impEmail = sessionStorage.getItem('svn_impersonate');
    if (impEmail) {
      // Ocultar elementos admin antes de qualquer render
      const adminStyle = document.createElement('style');
      adminStyle.textContent = '#tabAdmin, [data-admin-only], .admin-only { display: none !important; }';
      document.head.appendChild(adminStyle);

      if (!document.getElementById('impersonarBanner')) {
        const banner = document.createElement('div');
        banner.id = 'impersonarBanner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#7c3aed;color:white;padding:8px 20px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:0.82rem;font-weight:600;font-family:"Nunito Sans",sans-serif';
        banner.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Visualizando como: <strong>${impEmail}</strong>
          <button onclick="window._sairImpersonar()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:3px 10px;border-radius:6px;cursor:pointer;font-family:'Nunito Sans',sans-serif;font-weight:600;font-size:0.78rem;margin-left:6px">
            Sair ✕
          </button>`;
        document.body.prepend(banner);
        document.body.style.paddingTop = (parseInt(document.body.style.paddingTop || '0') + 40) + 'px';
      }
    }

    return this.user;
  },

  isAuthenticated() {
    return !!this.user;
  },

  requireAuth(redirectTo) {
    if (!this.user) {
      window.location.href = "/auth/login?redirect=" + encodeURIComponent(redirectTo || window.location.pathname);
      return false;
    }
    return true;
  },

  logout() {
    window.location.href = "/auth/logout";
  },

  getUserName() {
    return this.user ? this.user.name : "";
  },

  getUserEmail() {
    return this.user ? this.user.email : "";
  },

  getUserRole() {
    return this.user ? this.user.role : "colaborador";
  },

  isAdmin() {
    return this.user?.role === 'admin' || this.user?.role === 'gestor';
  },

  getInitials() {
    const name = this.getUserName();
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  },

  toggleUserMenu() {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  },

  renderHeader(container, options = {}) {
    if (!container) return;
    const { dark = false } = options;
    const logoUrl = dark ? URL_LOGO_BRANCA : URL_LOGO_PRETA;
    if (!this.user) return;
    const initials = this.getInitials();
    const name = this.getUserName();
    const lidos = this._getLidos();
    const naoLidos = [...this._pendenteIds].filter(id => !lidos.has(id));
    const badgeCount = naoLidos.length;

    container.innerHTML = `
      <div class="header-inner">
        <a href="/solicitacoes.html" class="header-logo"><img src="${logoUrl}" alt="SVN" height="24"></a>
        <div class="header-user" style="position:relative">
          <div id="userMenuTrigger" style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="Auth.toggleUserMenu()">
            <div class="avatar" style="position:relative">
              ${initials}
              <span id="notifBadgeAvatar" class="notif-badge" style="${badgeCount > 0 ? '' : 'display:none'}">${badgeCount > 9 ? '9+' : badgeCount}</span>
            </div>
            <span class="user-name">${name}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div id="userDropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:var(--card-white);border:1px solid var(--border-light);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:200px;z-index:200;overflow:hidden">
            <a href="/dashboard.html" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);text-decoration:none;border-bottom:1px solid var(--border-light)" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background='transparent'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Minhas solicitações
              <span id="notifBadgeMenu" class="notif-badge-menu" style="${badgeCount > 0 ? '' : 'display:none'}">Novo</span>
            </a>
            ${this.isAdmin() ? `
              <a href="/dashboard.html?tab=usuarios" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);text-decoration:none" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background='transparent'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                Usuários <span style="font-size:0.7rem;opacity:0.5;font-weight:400">(admin)</span>
              </a>
              <a href="/admin-templates.html" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);text-decoration:none;border-bottom:1px solid var(--border-light)" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background='transparent'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Templates de Arte <span style="font-size:0.7rem;opacity:0.5;font-weight:400">(admin)</span>
              </a>
            ` : ''}
            <button onclick="Auth.logout()" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);background:none;border:none;cursor:pointer;width:100%;text-align:left;font-family:'Nunito Sans',sans-serif" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background='transparent'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sair
            </button>
            ${this.isAdmin() ? `
              <div style="border-top:1px solid rgba(34,27,25,0.08);margin:4px 0;padding-top:4px">
                <div style="padding:6px 12px;font-size:0.72rem;font-weight:700;opacity:0.4;text-transform:uppercase;letter-spacing:0.05em">Admin</div>
                <div id="impersonarWrap" style="padding:4px 8px">
                  <div style="font-size:0.78rem;font-weight:600;opacity:0.6;margin-bottom:6px;padding:0 4px">Visualizar como:</div>
                  <div style="display:flex;gap:6px">
                    <input type="email" id="impersonarEmailInput" placeholder="email@svninvest.com.br"
                      style="flex:1;border:1px solid rgba(34,27,25,0.15);border-radius:7px;padding:5px 9px;font-family:'Nunito Sans',sans-serif;font-size:0.78rem;min-width:0"
                      onclick="event.stopPropagation()">
                    <button onclick="window._impersonar()" style="padding:5px 10px;background:var(--carbon-black);color:white;border:none;border-radius:7px;font-family:'Nunito Sans',sans-serif;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap">
                      Entrar
                    </button>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    if (!Auth._outsideClickListenerAdded) {
      Auth._outsideClickListenerAdded = true;
      document.addEventListener('click', function(e) {
        const trigger = document.getElementById('userMenuTrigger');
        const dd = document.getElementById('userDropdown');
        if (dd && trigger && !trigger.contains(e.target) && !dd.contains(e.target)) {
          dd.style.display = 'none';
        }
      });
    }
  }
};

// ── INTERCEPTOR GLOBAL DE FETCH — sessão expirada ─────────────
const _originalFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await _originalFetch(...args);
  const _reqUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
  if (res.status === 401 && Auth.initialized && Auth.user && !_reqUrl.includes('/auth/')) {
    if (typeof saveFormState === 'function') { try { saveFormState(); } catch {} }
    if (typeof saveDraft === 'function') { try { saveDraft(); } catch {} }
    window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return res;
  }
  return res;
};

// ── TRANSIÇÕES DE PÁGINA ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank' || link.hasAttribute('download')) return;
    e.preventDefault();
    document.body.style.transition = 'opacity 0.15s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = href; }, 150);
  });

  window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
      document.body.style.transition = 'none';
      document.body.style.opacity = '1';
    }
  });
});

// ── IMPERSONAÇÃO GLOBAL ───────────────────────────────────────
window._impersonar = async function() {
  const input = document.getElementById('impersonarEmailInput');
  const email = input?.value?.trim();
  if (!email || !email.includes('@')) {
    if (input) input.style.borderColor = 'var(--ruby-red)';
    return;
  }
  try {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      sessionStorage.setItem('svn_impersonate', email);
      const dropdown = document.getElementById('userDropdown');
      if (dropdown) dropdown.style.display = 'none';
      window.location.reload();
    } else {
      alert('Não foi possível entrar como esse usuário.');
    }
  } catch { alert('Erro de conexão.'); }
};

window._sairImpersonar = async function() {
  sessionStorage.removeItem('svn_impersonate');
  try {
    await fetch('/api/admin/impersonate/stop', { method: 'POST' });
  } catch {}
  window.location.reload();
};
