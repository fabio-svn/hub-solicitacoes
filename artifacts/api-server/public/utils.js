// Escape HTML para uso seguro em innerHTML/template strings
window.esc = function(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Ícone do ClickUp (SVG auto-contido com gradientes inline).
// Usado em cards/tabelas pra abrir tasks no ClickUp.
window.getClickupIcon = function() {
  return '<svg width="14" height="14" viewBox="0 0 54.8 65.8" xmlns="http://www.w3.org/2000/svg">' +
    '<path fill="#8930FD" d="M0,50.6l10.1-7.8c5.4,7,11.1,10.3,17.4,10.3c6.3,0,11.9-3.2,17-10.2l10.3,7.6c-7.4,10-16.6,15.3-27.3,15.3C16.9,65.8,7.6,60.5,0,50.6z"/>' +
    '<path fill="#FF02F0" d="M27.5,16.9l-18,15.5l-8.3-9.7L27.6,0l26.2,22.7l-8.4,9.6L27.5,16.9z"/>' +
  '</svg>';
};

function mascaraTelefone(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 10) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2,7) + '-' + v.substring(7);
  } else if (v.length > 6) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2,6) + '-' + v.substring(6);
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
    sa.innerHTML = '<div class="form-status form-status-loading"><span class="spinner"></span><span>Enviando sua solicitação... aguarde</span></div>';
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

function normalizeSlug(v) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}

function titleCasePtBr(text) {
  const keep = new Set(['de','da','do','das','dos','e','em','para','ao','aos','a','o']);
  return String(text).split(' ').filter(Boolean).map((w, i) => {
    if (i > 0 && keep.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function humanizeSlug(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  const map = {
    'pacote-padrao':'Pacote Padrão','em-producao':'Em produção','nao-definido':'Não definido',
    'aberto ao publico em geral':'Aberto ao público em geral','base-existente':'Base existente',
  };
  const key = normalizeSlug(raw);
  if (map[key]) return map[key];
  let h = titleCasePtBr(raw.replace(/[_-]+/g,' ').trim());
  [[/\bApresentacao\b/g,'Apresentação'],[/\bSolicitacao\b/g,'Solicitação'],
   [/\bPadrao\b/g,'Padrão'],[/\bProducao\b/g,'Produção'],[/\bNao\b/g,'Não'],
   [/\bPagina\b/g,'Página'],[/\bDivulgacao\b/g,'Divulgação'],[/\bAtualizacao\b/g,'Atualização'],
   [/\bPublico\b/g,'Público'],[/\bCertificacao\b/g,'Certificação']
  ].forEach(([p,r]) => { h = h.replace(p, r); });
  return h;
}

function formatarData(raw) {
  if (!raw) return '';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  let d;
  const matchISO = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchISO) {
    d = new Date(parseInt(matchISO[1]), parseInt(matchISO[2])-1, parseInt(matchISO[3]));
  } else {
    d = new Date(raw);
  }
  if (isNaN(d.getTime())) return String(raw);
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const ano = d.getFullYear();
  const diaFmt = String(dia).padStart(2, '0');
  const mesFmt = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia} de ${mes} de ${ano} (${diaFmt}/${mesFmt}/${ano})`;
}

function humanizeValue(key, value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';

  // Fonte da verdade: options do schema (label autoral, com acento/acronimo/frase).
  // Cobre todo select/radio automaticamente e tem prioridade sobre os mapas manuais.
  if (typeof window !== 'undefined' && window._svnFieldLabels) {
    const snakeKey = String(key).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    const fmap = window._svnFieldLabels[key] || window._svnFieldLabels[snakeKey];
    const lbl = fmap && fmap[String(value)];
    if (lbl) return lbl;
  }

  if (key === 'tipoMaterial' || key === 'tipoImpresso') {
    const map = {
      'cracha':'Crachá','crachá':'Crachá','roll-up':'Roll-Up','banner':'Banner',
      'flyer':'Flyer','folder':'Folder','totem':'Totem','adesivo':'Adesivo',
      'cartao':'Cartão','cartaz':'Cartaz','camisa':'Camisa','brinde':'Brinde',
      'documento':'Documento','carta':'Carta','camiseta':'Camiseta',
      'flyer-institucional':'Flyer Institucional','flyer-personalizado':'Flyer Personalizado',
      'bloco-notas':'Bloco de Notas','outro-impresso':'Outro',
    };
    const lv = String(value).toLowerCase();
    return map[lv] || humanizeSlug(String(value));
  }

  const dataCampos = ['dataEvento', 'prazoEntrega'];
  if (dataCampos.includes(key) && typeof value === 'string') {
    const formatted = formatarData(value);
    if (formatted !== value) return formatted;
  }

  // isPrivate/modeloCartao/modeloArte: removidos (8.3). Pós-migração os dados são snake_case
  // (is_private_key/modelo_cartao/modelo_arte) e o schema já resolve via _svnFieldLabels acima.

  if (key === 'estado') {
    const ibge = typeof IBGE_ESTADOS !== 'undefined' ? IBGE_ESTADOS : {};
    if (ibge[String(value)]) return ibge[String(value)];
    return String(value);
  }

  // Fallbacks que o schema (window._svnFieldLabels) NÃO cobre — mantidos de propósito:
  //  - natureza: valor legado 'patrocinio' (schema só tem presencial/online)
  //  - baseFlyer: campo sem options no schema
  // Os demais (maturidade, localEvento, modalidade, formatoPapel, orientacao, tamanho,
  // tipoCriacao, tipoAdesivo, tipoCamiseta, corCamiseta, temPalestrante, horBrasilia) eram
  // cópia exata do schema e já são resolvidos por _svnFieldLabels acima — removidos (8.2).
  const maps = {
    natureza:  { presencial:'Presencial', online:'Online', patrocinio:'Patrocínio' },
    baseFlyer: { sim:'Sim', nao:'Não' },
  };

  const matMap = {};
  if (typeof ITENS_MATERIAIS !== 'undefined') ITENS_MATERIAIS.forEach(i => { matMap[normalizeSlug(i.id)] = i.label; });
  if (typeof ITENS_MATERIAIS_ONLINE !== 'undefined') ITENS_MATERIAIS_ONLINE.forEach(i => { matMap[normalizeSlug(i.id)] = i.label; });

  if (key === 'materiais' && Array.isArray(value)) return value.map(v => matMap[normalizeSlug(v)] || humanizeSlug(v)).join(', ');
  if (key === 'materiais' && typeof value === 'string') {
    return value.split(',').map(v => v.trim()).filter(Boolean)
      .map(v => matMap[normalizeSlug(v)] || humanizeSlug(v)).join(', ');
  }
  if (key === 'selos') {
    const selosFallback = {
      'ancord':'Ancord','cea':'CEA','cfp':'CFP','cga':'CGA','cnpi':'CNPI',
      'cpa10':'CPA-10','cpa20':'CPA-20','xp-private':'XP Private','palestrante-svn':'Palestrante SVN',
    };
    const sm = { ...selosFallback };
    if (typeof SELOS_ASSESSOR !== 'undefined') SELOS_ASSESSOR.forEach(s => { sm[normalizeSlug(s.id)] = s.label; });
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(v => sm[normalizeSlug(v)] || String(v).toUpperCase()).join(' · ');
  }

  if (maps[key]) {
    const nv = normalizeSlug(String(value));
    for (const [mk, ml] of Object.entries(maps[key])) {
      if (normalizeSlug(String(mk)) === nv) return ml;
    }
  }

  if (typeof value === 'string' && typeof window.MARCAS_OPTS_FORM !== 'undefined') {
    const found = window.MARCAS_OPTS_FORM.find(m => m.value === value || m.label === value);
    if (found) return found.label;
  }
  const _phoneKeys = ['telefone', 'whatsapp', 'phone', 'tel'];
  const _looksLikePhone = typeof value === 'string' && /^\(\d{2}\)\s*\d/.test(value);
  // Só trata como slug se o valor INTEIRO for tokens ligados por - ou _ (ex.: "em-producao",
  // "flyer-institucional"). Texto livre, URLs e frases com espaço/quebra de linha passam direto.
  const _looksLikeSlug = typeof value === 'string'
    && /^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)+$/u.test(value.trim());
  if (_looksLikeSlug && !_phoneKeys.includes(key) && !_looksLikePhone) return humanizeSlug(value);
  // Ultimo recurso: token unico minusculo (so letras, sem espaco/digito) -> capitaliza inicial.
  // Ex.: "fisico" -> "Fisico", "online" -> "Online". Nao toca nome/email/telefone/multi-palavra.
  // Sim/Não: radios genericos do tipo sim/nao em qualquer form.
  {
    const _lv = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (_lv === 'sim') return 'Sim';
    if (_lv === 'nao' || _lv === 'não') return 'Não';
  }
  if (typeof value === 'string' && /^\p{L}{2,}$/u.test(value) && value === value.toLowerCase()) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
}

// ── Modal: helper compartilhado para modais padrão (.modal-overlay/.modal-card/.modal-close) ──
window.Modal = (function () {
  const escHandlers = {};
  function open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('visible');
    document.body.style.overflow = 'hidden';
    const h = function (e) { if (e.key === 'Escape') close(id); };
    escHandlers[id] = h;
    document.addEventListener('keydown', h);
  }
  function close(id, event) {
    const el = document.getElementById(id);
    if (!el) return;
    if (event && event.target !== el) return; // clique dentro do card não fecha
    el.classList.remove('visible');
    if (escHandlers[id]) { document.removeEventListener('keydown', escHandlers[id]); delete escHandlers[id]; }
    if (Object.keys(escHandlers).length === 0) document.body.style.overflow = '';
  }
  return { open: open, close: close };
})();