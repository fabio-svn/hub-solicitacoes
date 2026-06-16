/* filters.js — engine compartilhado do painel de filtros do Hub SVN.
 * Extraído das implementações idênticas de admin / dashboard / admin-log / admin-assets.
 *
 * Convenção de DOM (sufixo = <id> passado no register):
 *   #filterPanel<id>  #filterToggle<id>  #filterCount<id>  #filterClear<id>  #filterActiveBadges<id>
 *   chips: <button class="filter-chip" data-filter="<key>" data-value="<v>" data-label="<rótulo>">
 *
 * API:
 *   FilterPanel.register(id, { state, onChange, badges })  // badges:false desliga os badges removíveis
 *   FilterPanel.toggle(id)             // abre/fecha o painel (+ fecha ao clicar fora)
 *   FilterPanel.set(id, btn, key)      // aplica o valor do chip clicado
 *   FilterPanel.clearKey(id, key)      // limpa um filtro só (usado pelo × do badge)
 *   FilterPanel.clear(id)             // limpa todos
 *   FilterPanel.hasActive(id)         // bool
 */
window.FilterPanel = (function () {
  const reg = {};

  function register(id, opts) {
    opts = opts || {};
    reg[id] = {
      state: opts.state || {},
      onChange: typeof opts.onChange === 'function' ? opts.onChange : function () {},
      badges: opts.badges !== false,
    };
    _updateUI(id);
    return reg[id];
  }

  function _panel(id) { return document.getElementById('filterPanel' + id); }

  function toggle(id) {
    const panel = _panel(id);
    if (!panel) return;
    const btn = document.getElementById('filterToggle' + id);
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    if (!hasActive(id) && isOpen && btn) btn.classList.remove('has-filters');
    if (!isOpen) {
      setTimeout(function () {
        document.addEventListener('click', function handler(e) {
          if (!panel.parentElement.contains(e.target)) {
            panel.classList.remove('open');
            document.removeEventListener('click', handler);
          }
        });
      }, 0);
    }
  }

  function _markChips(id, key) {
    const r = reg[id];
    const panel = _panel(id);
    if (!r || !panel) return;
    panel.querySelectorAll('[data-filter="' + key + '"]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === r.state[key]);
    });
  }

  function set(id, btn, key) {
    const r = reg[id];
    if (!r || !btn) return;
    r.state[key] = btn.dataset.value;
    _markChips(id, key);
    _updateUI(id);
    r.onChange();
  }

  function clearKey(id, key) {
    const r = reg[id];
    if (!r) return;
    r.state[key] = '';
    _markChips(id, key);
    _updateUI(id);
    r.onChange();
  }

  function clear(id) {
    const r = reg[id];
    if (!r) return;
    Object.keys(r.state).forEach(function (k) { r.state[k] = ''; });
    const panel = _panel(id);
    if (panel) panel.querySelectorAll('.filter-chip').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === '');
    });
    _updateUI(id);
    r.onChange();
  }

  function hasActive(id) {
    const r = reg[id];
    if (!r) return false;
    return Object.values(r.state).some(function (v) { return v !== ''; });
  }

  function _updateUI(id) {
    const r = reg[id];
    if (!r) return;
    const count = Object.values(r.state).filter(function (v) { return v !== ''; }).length;
    const countBadge = document.getElementById('filterCount' + id);
    const clearBtn = document.getElementById('filterClear' + id);
    const btn = document.getElementById('filterToggle' + id);
    if (count > 0) {
      if (countBadge) { countBadge.textContent = count; countBadge.style.display = 'inline-flex'; }
      if (clearBtn) clearBtn.style.display = 'inline-block';
      if (btn) btn.classList.add('has-filters');
    } else {
      if (countBadge) countBadge.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
      if (btn) btn.classList.remove('has-filters');
    }

    if (!r.badges) return;
    const badgesContainer = document.getElementById('filterActiveBadges' + id);
    if (!badgesContainer) return;
    badgesContainer.innerHTML = '';
    Object.entries(r.state).forEach(function (entry) {
      const key = entry[0], value = entry[1];
      if (!value) return;
      const btnRef = document.querySelector('#filterPanel' + id + ' [data-filter="' + key + '"][data-value="' + value + '"]');
      if (!btnRef) return;
      const badge = document.createElement('span');
      badge.className = 'filter-active-badge';
      badge.appendChild(document.createTextNode((btnRef.dataset.label || value) + ' '));
      const x = document.createElement('span');
      x.className = 'remove-badge';
      x.textContent = '\u00d7';
      x.addEventListener('click', function () { clearKey(id, key); });
      badge.appendChild(x);
      badgesContainer.appendChild(badge);
    });
  }

  return { register: register, toggle: toggle, set: set, clearKey: clearKey, clear: clear, hasActive: hasActive };
})();
