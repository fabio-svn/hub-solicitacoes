const Auth = {
  user: null,
  initialized: false,

  async init() {
    if (this.initialized) return this.user;
    try {
      const res = await fetch("/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        this.user = data.user;
      }
      this.initialized = true;
    } catch (e) {
      console.error("Auth check failed:", e);
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

  getInitials() {
    const name = this.getUserName();
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  },

  renderHeader(container, options = {}) {
    const { dark = false } = options;
    const logoUrl = dark ? URL_LOGO_BRANCA : URL_LOGO_PRETA;
    if (!this.user) return;
    container.innerHTML = `
      <div class="header-inner">
        <a href="/" class="header-logo"><img src="${logoUrl}" alt="SVN" height="24"></a>
        <div class="header-user">
          <div class="avatar">${this.getInitials()}</div>
          <span class="user-name">${this.getUserName()}</span>
          <a href="/auth/logout" class="logout-link">Sair</a>
        </div>
      </div>
    `;
  }
};
