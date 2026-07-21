window.Shell = {
  _activeRoute: null,
  _onBeforeNavigate: null,

  render({ activeRoute, contentEl, onBeforeNavigate } = {}) {
    this._activeRoute = activeRoute;
    this._onBeforeNavigate = onBeforeNavigate || null;

    // Reserva imediata: se localStorage indica admin e o atributo ainda não foi
    // setado pelo script inline do <head>, garantir agora antes de qualquer layout.
    try {
      const cached = JSON.parse(localStorage.getItem('svn_layout_state') || '{}');
      if (cached.isAdmin && !document.documentElement.hasAttribute('data-pre-shell')) {
        document.documentElement.setAttribute('data-pre-shell', 'admin');
      }
    } catch {}

    const hasSidebar = typeof Auth !== 'undefined' && Auth.hasSidebar();
    const role = typeof Auth !== 'undefined' ? Auth.getUserRole() : 'colaborador';
    const isImpersonating = !!sessionStorage.getItem('svn_impersonate');
    const collapsed = localStorage.getItem('svn_sidebar_collapsed') === 'true';

    const legacyHeader = document.getElementById('mainHeader');
    if (legacyHeader) legacyHeader.remove();

    const shellEl = document.createElement('div');
    shellEl.className = 'app-shell'
      + (hasSidebar ? '' : ' no-sidebar')
      + (collapsed ? ' sidebar-collapsed' : '')
      + (isImpersonating ? ' is-impersonating' : '');
    if (hasSidebar) shellEl.setAttribute('data-is-admin', 'true');

    shellEl.innerHTML =
      this._buildHeader(hasSidebar) +
      (hasSidebar ? this._buildSidebar(activeRoute, role) : '') +
      '<main class="app-main" id="appMain"></main>';

    if (contentEl && contentEl.parentNode) {
      contentEl.parentNode.removeChild(contentEl);
    }

    document.body.prepend(shellEl);

    const main = shellEl.querySelector('#appMain');
    if (contentEl) main.appendChild(contentEl);

    // Remover atributo pré-shell APÓS o shell e o conteúdo já estarem no DOM,
    // assim o CSS de reserva (padding-left + opacity) dissolve suavemente.
    document.documentElement.removeAttribute('data-pre-shell');

    this._renderImpersonationBanner(isImpersonating);
    this._bindEvents();
    this._syncNotifBadge();
    this._initResumoDrawer();
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
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#7c3aed;color:#fff;padding:8px 20px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:0.82rem;font-weight:600;font-family:"Nunito Sans", sans-serif';
      el.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Visualizando como: <strong>' + window.esc(email) + '</strong> <button onclick="window._sairImpersonar()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:3px 10px;border-radius:var(--radius-sm);cursor:pointer;font-family:\'Nunito Sans\', sans-serif;font-weight:600;font-size:0.78rem;margin-left:6px">Sair ✕</button>';
      document.body.prepend(el);
    }
    document.body.style.paddingTop = '40px';
  },

  _buildHeader(isAdmin) {
    const initials = typeof Auth !== 'undefined' ? window.esc(Auth.getInitials()) : '?';
    const name = typeof Auth !== 'undefined' ? window.esc(Auth.getUserName()) : '';
    const logoUrl = typeof URL_LOGO_PRETA !== 'undefined' ? URL_LOGO_PRETA : '';

    return `<header class="app-header" id="appShellHeader">
      <div class="app-header-left">
        ${isAdmin ? `<button class="sidebar-toggle-btn" onclick="Shell.toggleSidebar()" title="Recolher menu" aria-label="Recolher menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>` : ''}
        <a href="/solicitacoes.html" class="app-header-logo">
          ${logoUrl ? `<img src="${logoUrl}" alt="SVN" height="22">` : `<span style="font-weight:800;font-size:1rem;letter-spacing:0.02em">SVN</span>`}
        </a>
      </div>
      <div class="app-header-right">
        <button id="shellBuscaBtn" type="button" onclick="window.SvnBuscaRapida && window.SvnBuscaRapida.abrir()"
            title="Buscar formulário (Ctrl+K)" aria-label="Buscar formulário"
            style="display:inline-flex;align-items:center;gap:7px;margin-right:12px;padding:6px 11px;
                   background:transparent;border:1px solid var(--border-light,#e8e0d8);
                   border-radius:var(--radius-pill,999px);cursor:pointer;color:var(--ink-60,#5A544F);font:inherit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
            </svg>
            <span style="font-size:0.8rem">Buscar</span>
            <kbd id="shellBuscaKbd" style="font:inherit;font-size:0.68rem;font-weight:700;padding:1px 5px;
                 border-radius:4px;background:var(--icon-bg,#f4ece1);color:var(--ink-50,#8A8580)">⌘K</kbd>
          </button>
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
            <a href="/solicitacoes.html" class="app-dropdown-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Fazer solicitações
            </a>
            <a href="/dashboard.html" class="app-dropdown-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
              Minhas solicitações
              <span id="shellNotifBadgeMenu" class="notif-badge-menu" style="display:none"></span>
            </a>
            <a href="/meus-dados.html" class="app-dropdown-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Meus dados
            </a>
            <a href="/auth/logout" class="app-dropdown-item" style="border-top:1px solid var(--border-light)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sair
            </a>
          </div>
        </div>
      </div>
    </header>`;
  },

  _buildSidebar(activeRoute, role) {
    const nav = [
      {
        route: 'solicitacoes',
        href: '/solicitacoes.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
        label: 'Solicitações',
        roles: ['admin', 'gestor', 'capital_humano'],
      },
      {
        route: 'dashboard',
        href: '/dashboard.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
        label: 'Minhas solicitações',
        roles: ['admin', 'gestor', 'capital_humano'],
      },
      {
        route: 'convite-corporate',
        href: '/convite-corporate.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
        label: 'Convites',
        roles: ['admin', 'corporate'],
      },
      {
        route: 'capital-humano',
        href: '/capital-humano.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
        label: 'Capital Humano',
        roles: ['admin', 'capital_humano'],
      },
      {
        route: 'validacao-cartoes',
        href: '/validacao-cartoes.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="12" y2="15"/></svg>',
        label: 'Validação de Cartões',
        roles: ['admin', 'capital_humano', 'gestor'],
      },
      {
        route: 'validacao-assessores',
        href: '/validacao-assessores.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-1.5-1.5"/></svg>',
        label: 'Validação de Assessores',
        roles: ['admin', 'capital_humano', 'gestor'],
      },
      {
        route: 'admin-tombamentos',
        href: '/admin-tombamentos.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="4" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
        label: 'Tombamentos',
        roles: ['admin', 'capital_humano'],
      },
    ];

    const adminItems = [
      {
        route: 'admin-painel',
        href: '/admin.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        label: 'Painel Admin',
        roles: ['admin', 'gestor'],
      },
      {
        route: 'admin-log',
        href: '/admin-log.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        label: 'Log de atividade',
        roles: ['admin', 'gestor'],
      },
      {
        route: 'admin-templates',
        href: '/admin-templates.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
        label: 'Templates de arte',
        roles: ['admin'],
      },
      {
        route: 'admin-assets',
        href: '/admin-assets.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        label: 'Assets',
        roles: ['admin'],
      },
      {
        route: 'admin-usuarios',
        href: '/admin-usuarios.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
        label: 'Usuários',
        roles: ['admin'],
      },
      {
        route: 'admin-clickup-lists',
        href: '/admin-clickup-lists.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
        label: 'Listas do ClickUp',
        roles: ['admin'],
      },
    ];

    const visibleNav = nav.filter(it => !it.roles || it.roles.includes(role));
    const visibleAdminItems = adminItems.filter(it => !it.roles || it.roles.includes(role));

    const buildLink = (item) => {
      const isActive = item.route === activeRoute;
      return `<a href="${item.href}" class="sidebar-link${isActive ? ' active' : ''}" data-route="${item.route}">
        <span class="sidebar-icon">${item.icon}</span>
        <span class="sidebar-label">${window.esc(item.label)}</span>
      </a>`;
    };

    return `<aside class="app-sidebar" id="appSidebar">
      <nav class="sidebar-nav">
        ${visibleNav.map(buildLink).join('')}
        ${visibleAdminItems.length ? `<div class="sidebar-section">
          <div class="sidebar-section-title">Administração</div>
          ${visibleAdminItems.map(buildLink).join('')}
        </div>` : ''}
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
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.querySelectorAll('[autofocus]').forEach(el => {
        el.removeAttribute('autofocus');
        if (document.activeElement === el) el.blur();
      });
    }
  },

  _syncNotifBadge() {
    if (typeof Auth === 'undefined' || !Auth.getPendentesCount) return;
    const count = Auth.getPendentesCount();

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

  _initResumoDrawer() {
    const sidebar = document.querySelector('.form-sidebar');
    if (!sidebar) return;
    if (document.querySelector('.resumo-fab')) return;

    const fab = document.createElement('button');
    fab.className = 'resumo-fab';
    fab.setAttribute('aria-label', 'Ver resumo do pedido');
    fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>`;
    document.body.appendChild(fab);

    const header = document.createElement('div');
    header.className = 'form-sidebar-mobile-header';
    header.innerHTML = `
      <div class="form-sidebar-mobile-title">Resumo do pedido</div>
      <button class="form-sidebar-mobile-close" aria-label="Fechar">&times;</button>
    `;
    sidebar.insertBefore(header, sidebar.firstChild);

    const open = () => document.body.classList.add('resumo-drawer-open');
    const close = () => document.body.classList.remove('resumo-drawer-open');

    fab.addEventListener('click', open);
    header.querySelector('.form-sidebar-mobile-close').addEventListener('click', close);

    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('resumo-drawer-open')) return;
      if (e.target.closest('.form-sidebar') || e.target.closest('.resumo-fab')) return;
      close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  },

  toggleSidebar() {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const open = shell.classList.toggle('sidebar-open');
      if (open) {
        setTimeout(() => {
          const close = (e) => {
            const tappedLink = e.target.closest('.sidebar-link');
            const tappedSidebar = e.target.closest('.app-sidebar');
            const tappedToggle = e.target.closest('.sidebar-toggle-btn');
            if (tappedLink || (!tappedSidebar && !tappedToggle)) {
              shell.classList.remove('sidebar-open');
              document.removeEventListener('click', close);
            }
          };
          document.addEventListener('click', close);
        }, 0);
      }
    } else {
      const collapsed = shell.classList.toggle('sidebar-collapsed');
      localStorage.setItem('svn_sidebar_collapsed', String(collapsed));
    }
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

};

// ── Float WhatsApp (injetado 1x aqui; idempotente) ──────────────
(function () {
  function _injectWhatsappFloat() {
    if (document.querySelector('.float-whatsapp')) return;
    var a = document.createElement('a');
    a.href = 'https://wa.me/5544991689207';
    a.target = '_blank'; a.rel = 'noopener';
    a.className = 'float-whatsapp';
    a.title = 'Falar com o time de Marketing';
    a.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.484 2 12.017c0 1.99.521 3.86 1.43 5.484L2 22l4.644-1.414A9.96 9.96 0 0011.999 22C17.523 22 22 17.516 22 11.983 22 6.472 17.523 2 11.999 2zm0 18.15a8.124 8.124 0 01-4.162-1.145l-.299-.178-3.088.941.923-3.121-.196-.32A8.185 8.185 0 013.85 11.983c0-4.51 3.644-8.183 8.15-8.183 4.507 0 8.152 3.672 8.152 8.183 0 4.51-3.645 8.167-8.153 8.167z"/></svg>';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _injectWhatsappFloat);
  else _injectWhatsappFloat();
})();


/* ── Busca rapida (Ctrl+K / Cmd+K) ───────────────────────────────────────────
   Atalho para quem ja sabe o que quer: em vez de percorrer os cards da home,
   digita duas letras e vai direto ao formulario. Usa TIPO_SOLICITACAO_LABELS,
   entao qualquer tipo novo aparece aqui sem alteracao. */
(function () {
  var aberto = false, itens = [], idx = 0, termoAtual = '';

  /* Mesma lista que monta os cards da home. TIPO_SOLICITACAO_LABELS nao serve
     aqui: inclui subtipos de etapa ("Pagina de Assessores — Dados") que nao tem
     formulario proprio — o subtipo e escolhido DENTRO do form. Apontar para
     /form-pagina-assessores-dados.html dava 404. */
  /* Rotulos dos subtipos deste formulario, para servirem de termo de busca.
     Os ids de subtipo comecam com o id do pai ("cartao-visita-digital" nasce de
     "cartao-visita"), entao nao ha lista para manter: tipo novo entra sozinho.
     O usuario digita "digital" e chega em Cartao de Visita, que e onde a opcao
     de fato existe. */
  function subtiposDe(id) {
    if (typeof TIPO_SOLICITACAO_LABELS === 'undefined') return [];
    var out = [];
    Object.keys(TIPO_SOLICITACAO_LABELS).forEach(function (t) {
      if (t !== id && t.indexOf(id + '-') === 0) {
        var lbl = TIPO_SOLICITACAO_LABELS[t];
        // guarda so o que vem depois do travessao: "Cartao de Visita — Digital" -> "Digital"
        var parte = String(lbl).split(/\s+[—-]\s+/).pop();
        if (parte && out.indexOf(parte) < 0) out.push(parte);
      }
    });
    return out;
  }

  function catalogo() {
    if (typeof CATEGORIAS_SOLICITACAO === 'undefined') return [];
    var out = [];
    CATEGORIAS_SOLICITACAO.forEach(function (cat) {
      (cat.itens || []).forEach(function (it) {
        if (it.ativo === false) return;
        // FORM_ROUTES e o mapa que a home usa no clique do card. Nem todo id bate
        // com o nome do arquivo ("apresentacao" -> form-apresentacoes.html), entao
        // montar a URL pelo id daria 404 em alguns.
        var rota = (typeof FORM_ROUTES !== 'undefined') ? FORM_ROUTES[it.id] : null;
        if (!rota) return;
        out.push({
          tipo: it.id,
          label: it.label,
          categoria: cat.categoria || '',
          url: '/' + String(rota).replace(/^[/]/, ''),
          termos: subtiposDe(it.id).concat(it.busca || []),
        });
      });
    });
    return out;
  }

  function montar() {
    if (document.getElementById('svnBuscaRapida')) return;
    var el = document.createElement('div');
    el.id = 'svnBuscaRapida';
    el.setAttribute('role', 'dialog');
    el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;' +
      'background:rgba(34,27,25,0.38);backdrop-filter:blur(2px);padding:14vh 16px 16px';
    el.innerHTML =
      '<div style="max-width:520px;margin:0 auto;background:var(--card-white,#FFFFFE);' +
      'border-radius:var(--radius-lg,14px);box-shadow:0 18px 50px rgba(34,27,25,0.28);overflow:hidden">' +
        '<input id="svnBuscaInput" type="text" autocomplete="off" placeholder="Buscar formulário..." ' +
        'style="width:100%;box-sizing:border-box;border:none;outline:none;font:inherit;' +
        'font-size:1rem;padding:16px 18px;border-bottom:1px solid var(--border-light,#e8e0d8)">' +
        '<div id="svnBuscaLista" style="max-height:46vh;overflow-y:auto"></div>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (ev) { if (ev.target === el) fechar(); });
    document.getElementById('svnBuscaInput').addEventListener('input', function () { filtrar(this.value); });
  }

  function filtrar(termo) {
    var t = String(termo || '').trim().toLowerCase();
    var todos = catalogo();
    itens = t ? todos.filter(function (x) {
      if (x.label.toLowerCase().indexOf(t) >= 0) return true;
      if (x.categoria && x.categoria.toLowerCase().indexOf(t) >= 0) return true;
      return (x.termos || []).some(function (s2) { return s2.toLowerCase().indexOf(t) >= 0; });
    }) : todos.slice(0, 8);
    termoAtual = t;
    idx = 0;
    pintar();
  }

  function pintar() {
    var lista = document.getElementById('svnBuscaLista');
    if (!lista) return;
    if (!itens.length) {
      lista.innerHTML = '<p style="margin:0;padding:18px;font-size:0.88rem;color:var(--ink-50,#8A8580)">Nada encontrado.</p>';
      return;
    }
    lista.innerHTML = itens.map(function (x, i) {
      // se o termo casou com um subtipo, mostra qual — assim fica claro por que
      // este formulario apareceu.
      var achado = null;
      if (termoAtual) {
        achado = (x.termos || []).filter(function (s2) {
          return s2.toLowerCase().indexOf(termoAtual) >= 0;
        })[0] || null;
      }
      var cat = '';
      if (achado) {
        // destaca o pedaco digitado dentro da opcao encontrada
        var e = window.esc ? window.esc(achado) : achado;
        var pos = e.toLowerCase().indexOf(termoAtual);
        var marcado = pos < 0 ? e
          : e.slice(0, pos)
            + '<mark style="background:rgba(172,54,49,0.14);color:var(--ruby-red,#AC3631);'
            + 'font-weight:700;border-radius:3px;padding:0 2px">' + e.slice(pos, pos + termoAtual.length) + '</mark>'
            + e.slice(pos + termoAtual.length);
        cat = '<span style="display:block;font-size:0.76rem;color:var(--ink-60,#5A544F);margin-top:3px">'
            + 'tem a opção ' + marcado + '</span>';
      } else if (x.categoria) {
        cat = '<span style="display:block;font-size:0.72rem;color:var(--ink-50,#8A8580);margin-top:2px">'
            + (window.esc ? window.esc(x.categoria) : x.categoria) + '</span>';
      }
      return '<button data-i="' + i + '" style="display:block;width:100%;text-align:left;border:none;' +
        'font:inherit;font-size:0.92rem;padding:11px 18px;cursor:pointer;' +
        'background:' + (i === idx ? 'var(--icon-bg,#f4ece1)' : 'transparent') + ';' +
        'color:var(--carbon-black,#221B19)">' + (window.esc ? window.esc(x.label) : x.label) + cat + '</button>';
    }).join('');
    Array.prototype.forEach.call(lista.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { ir(parseInt(b.dataset.i, 10)); });
      b.addEventListener('mousemove', function () { idx = parseInt(b.dataset.i, 10); pintar(); });
    });
  }

  function ir(i) {
    var alvo = itens[i];
    if (alvo) window.location.href = alvo.url;
  }

  function abrir() {
    montar();
    var el = document.getElementById('svnBuscaRapida');
    el.style.display = '';
    aberto = true;
    var inp = document.getElementById('svnBuscaInput');
    inp.value = '';
    filtrar('');
    setTimeout(function () { inp.focus(); }, 0);
  }

  function fechar() {
    var el = document.getElementById('svnBuscaRapida');
    if (el) el.style.display = 'none';
    aberto = false;
  }

  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); aberto ? fechar() : abrir(); return; }
    if (!aberto) return;
    if (k === 'escape') { e.preventDefault(); fechar(); }
    else if (k === 'arrowdown') { e.preventDefault(); idx = Math.min(idx + 1, itens.length - 1); pintar(); }
    else if (k === 'arrowup') { e.preventDefault(); idx = Math.max(idx - 1, 0); pintar(); }
    else if (k === 'enter') { e.preventDefault(); ir(idx); }
  });

  // Windows mostra Ctrl, Mac mostra Cmd
  try {
    var ehMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    document.addEventListener('DOMContentLoaded', function () {
      var k = document.getElementById('shellBuscaKbd');
      if (k) k.textContent = ehMac ? '\u2318K' : 'Ctrl K';
    });
  } catch (_) {}

  window.SvnBuscaRapida = { abrir: abrir, fechar: fechar };
})();
