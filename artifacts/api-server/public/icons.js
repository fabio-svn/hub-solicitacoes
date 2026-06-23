/*
 * icons.js — Sistema central de ícones do Hub SVN.
 *
 * Fonte única de ícones de UI: todos em grade 24×24, traço 1.5, currentColor,
 * estilo line/outline (alinhado à identidade SVN). Em vez de colar <svg> solto
 * em cada tela, use ícones NOMEADOS por função:
 *
 *   - No HTML estático:  <span data-icon="search"></span>
 *                        (resolvido automaticamente no load por renderIcons())
 *   - Em conteúdo gerado por JS:  ... + icon('trash') + ...
 *
 * Atributos opcionais no data-icon: data-icon-size, data-icon-style, data-icon-class.
 * Opções no icon(name, { size, style, class }).
 *
 * Os valores abaixo são SÓ o conteúdo interno do <svg> (paths). O wrapper —
 * incluindo o stroke-width unificado — é montado por buildSvg(), então mudar o
 * peso do traço em todo o Hub é mudar UMA linha aqui (STROKE_WIDTH).
 */
(function (global) {
  'use strict';

  var STROKE_WIDTH = '1.5';
  var DEFAULT_SIZE = 18;

  var ICONS = {
    // --- Ações / navegação ---
    'search':        '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>',
    'filter':        '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'columns':       '<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/>',
    'download':      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'trash':         '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    'edit':          '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    'plus':          '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'x':             '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'check':         '<polyline points="20 6 9 17 4 12"/>',

    // --- Setas / chevrons ---
    'arrow-right':   '<line x1="4" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'arrow-left':    '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'chevron-down':  '<polyline points="6 9 12 15 18 9"/>',
    'chevron-up':    '<polyline points="18 15 12 9 6 15"/>',

    // --- Indicadores ---
    'dots':          '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    'star':          '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',

    // --- Comuns (reuso nas próximas telas) ---
    'image':         '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'upload':        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    'user':          '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'mail':          '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
    'calendar':      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
  };

  function buildSvg(name, opts) {
    opts = opts || {};
    var inner = ICONS[name];
    if (inner == null) { return ''; }
    var size = opts.size || DEFAULT_SIZE;
    var cls = opts['class'] ? ' class="' + opts['class'] + '"' : '';
    var style = opts.style ? ' style="' + opts.style + '"' : '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="' + STROKE_WIDTH + '" stroke-linecap="round" '
      + 'stroke-linejoin="round"' + cls + style + ' aria-hidden="true">' + inner + '</svg>';
  }

  // Resolve <span data-icon="nome"> (e <i>, <span>, etc.) para o SVG correspondente.
  function renderIcons(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-icon]:not([data-icon-done])');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var name = el.getAttribute('data-icon');
      el.innerHTML = buildSvg(name, {
        size: el.getAttribute('data-icon-size') || DEFAULT_SIZE,
        style: el.getAttribute('data-icon-style') || '',
        'class': el.getAttribute('data-icon-class') || ''
      });
      el.setAttribute('data-icon-done', '1');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { renderIcons(); });
  } else {
    renderIcons();
  }

  // API global (scripts clássicos compartilham escopo, como config.js).
  global.icon = buildSvg;
  global.renderIcons = renderIcons;
  global.ICON_NAMES = Object.keys(ICONS);
})(window);