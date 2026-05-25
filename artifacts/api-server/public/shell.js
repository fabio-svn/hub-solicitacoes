window.Shell = {
  _activeRoute: null,
  _onBeforeNavigate: null,

  render({ activeRoute, contentEl, onBeforeNavigate } = {}) {
    this._activeRoute = activeRoute;
    this._onBeforeNavigate = onBeforeNavigate || null;

    const isAdmin = typeof Auth !== 'undefined' && Auth.isAdmin();
    const isImpersonating = !!sessionStorage.getItem('svn_impersonate');
    const collapsed = localStorage.getItem('svn_sidebar_collapsed') === 'true';

    const legacyHeader = document.getElementById('mainHeader');
    if (legacyHeader) legacyHeader.remove();

    const shellEl = document.createElement('div');
    shellEl.className = 'app-shell'
      + (isAdmin ? '' : ' no-sidebar')
      + (collapsed ? ' sidebar-collapsed' : '')
      + (isImpersonating ? ' is-impersonating' : '');
    if (isAdmin) shellEl.setAttribute('data-is-admin', 'true');

    shellEl.innerHTML =
      this._buildHeader(isAdmin) +
      (isAdmin ? this._buildSidebar(activeRoute) : '') +
      '<main class="app-main" id="appMain"></main>';

    if (contentEl && contentEl.parentNode) {
      contentEl.parentNode.removeChild(contentEl);
    }

    // Remover hint pré-shell (CSS de reserva)
    document.documentElement.removeAttribute('data-pre-shell');
    document.body.prepend(shellEl);

    const main = shellEl.querySelector('#appMain');
    if (contentEl) main.appendChild(contentEl);

    this._renderImpersonationBanner(isImpersonating);
    this._bindEvents();
    this._syncNotifBadge();
  },

  _renderImpersonationBanner(isImpersonating) {
    const banner = document.getElementById('impersonarBanner');
    const hideStyle = document.getElementById('impersonarHideStyle');
    if (!isImpersonating) {
      if (banner) banner.remove();
      if (hideStyle) hideStyle.remove();
      document.body.style.paddingTop = '';
      return;
    }
    if (!hideStyle) {
      const st = document.createElement('style');
      st.id = 'impersonarHideStyle';
      st.textContent = '#tabAdmin, [data-admin-only], .admin-only { display: none !important; }';
      document.head.appendChild(st);
    }
    if (!banner) {
      const email = sessionStorage.getItem('svn_impersonate') || '';
      const el = document.createElement('div');
      el.id = 'impersonarBanner';
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#7c3aed;color:#fff;padding:8px 20px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:0.82rem;font-weight:600;font-family:"Nunito Sans",sans-serif';
      el.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Visualizando como: <strong>' + this._esc(email) + '</strong> <button onclick="window._sairImpersonar()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:3px 10px;border-radius:6px;cursor:pointer;font-family:\'Nunito Sans\',sans-serif;font-weight:600;font-size:0.78rem;margin-left:6px">Sair ✕</button>';
      document.body.prepend(el);
    }
    document.body.style.paddingTop = '40px';
  },

  _buildHeader(isAdmin) {
    const initials = typeof Auth !== 'undefined' ? this._esc(Auth.getInitials()) : '?';
    const name = typeof Auth !== 'undefined' ? this._esc(Auth.getUserName()) : '';
    const logoUrl = typeof URL_LOGO_PRETA !== 'undefined' ? URL_LOGO_PRETA : '';

    return `<header class="app-header" id="appShellHeader">
      <div class="app-header-left">
        ${isAdmin ? `<button class="sidebar-toggle-btn" onclick="Shell.toggleSidebar()" title="Recolher menu" aria-label="Recolher menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>` : ''}
        <a href="/index.html" class="app-header-logo">
          ${logoUrl ? `<img src="${logoUrl}" alt="SVN" height="22">` : `<span style="font-weight:800;font-size:1rem;letter-spacing:0.02em">SVN</span>`}
        </a>
      </div>
      <div class="app-header-right">
        <div class="app-user-menu" id="appUserMenu">
          <div class="app-user-trigger" id="appUserTrigger" onclick="Shell.toggleUserMenu()">
            <div class="app-avatar" id="appAvatarEl">
              ${initials}
              <span id="shellNotifBadge" class="notif-badge" style="display:none"></span>
            </div>
            <span class="app-user-name">${name}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="app-user-dropdown" id="appUserDropdown" style="display:none">
            <a href="/index.html" class="app-dropdown-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </a>
            <a href="/solicitacoes.html" class="app-dropdown-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Fazer solicitações
            </a>
            <a href="/dashboard.html" class="app-dropdown-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
              Minhas solicitações
              <span id="shellNotifBadgeMenu" class="notif-badge-menu" style="display:none"></span>
            </a>
            <a href="/auth/logout" class="app-dropdown-item" style="border-top:1px solid var(--border-light)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sair
            </a>
          </div>
        </div>
      </div>
    </header>`;
  },

  _buildSidebar(activeRoute) {
    const nav = [
      {
        route: 'dashboard',
        href: '/dashboard.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
        label: 'Minhas solicitações',
      },
    ];

    const adminItems = [
      {
        route: 'admin-painel',
        href: '/admin.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        label: 'Painel Admin',
      },
      {
        route: 'admin-log',
        href: '/admin-log.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        label: 'Log de atividade',
      },
      {
        route: 'admin-templates',
        href: '/admin-templates.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
        label: 'Templates de arte',
      },
      {
        route: 'admin-assets',
        href: '/admin-assets.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        label: 'Assets',
      },
      {
        route: 'admin-usuarios',
        href: '/admin-usuarios.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
        label: 'Usuários',
      },
      {
        route: 'admin-clickup-lists',
        href: '/admin-clickup-lists.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
        label: 'Listas do ClickUp',
      },
    ];

    const buildLink = (item) => {
      const isActive = item.route === activeRoute;
      return `<a href="${item.href}" class="sidebar-link${isActive ? ' active' : ''}" data-route="${item.route}">
        <span class="sidebar-icon">${item.icon}</span>
        <span class="sidebar-label">${this._esc(item.label)}</span>
      </a>`;
    };

    return `<aside class="app-sidebar" id="appSidebar">
      <nav class="sidebar-nav">
        ${nav.map(buildLink).join('')}
        <div class="sidebar-section">
          <div class="sidebar-section-title">Administração</div>
          ${adminItems.map(buildLink).join('')}
        </div>
      </nav>
    </aside>`;
  },

  _bindEvents() {
    document.addEventListener('click', (e) => {
      const trigger = document.getElementById('appUserTrigger');
      const dd = document.getElementById('appUserDropdown');
      if (dd && trigger && !trigger.contains(e.target) && !dd.contains(e.target)) {
        dd.style.display = 'none';
      }
    });
  },

  _syncNotifBadge() {
    if (typeof Auth === 'undefined' || !Auth._pendenteIds) return;
    const lidos = Auth._getLidos ? Auth._getLidos() : new Set();
    const count = [...Auth._pendenteIds].filter(id => !lidos.has(id)).length;

    const badge = document.getElementById('shellNotifBadge');
    if (badge) {
      badge.style.display = count > 0 ? '' : 'none';
      badge.textContent = count > 9 ? '9+' : String(count);
    }
    const badgeMenu = document.getElementById('shellNotifBadgeMenu');
    if (badgeMenu) {
      badgeMenu.style.display = count > 0 ? '' : 'none';
    }
  },

  toggleSidebar() {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('svn_sidebar_collapsed', String(collapsed));
  },

  toggleUserMenu() {
    const dd = document.getElementById('appUserDropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  },

  async navigate(url) {
    if (this._onBeforeNavigate) {
      const ok = await Promise.resolve(this._onBeforeNavigate(url));
      if (!ok) return;
    }
    window.location.href = url;
  },

  _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};
