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


/* ─────────────────────────────────────────────────────────────────────────
   SvnChip — chip de link, usado no resumo da solicitacao E no modal de
   validacao. Antes cada tela tinha a sua versao; a informacao e a mesma,
   entao o desenho tambem deve ser.

   Redes sociais levam a cor da marca (reconhecimento imediato, e sao poucas).
   Arquivos ficam no traco monocromatico do sistema: sao muitos formatos e
   nenhum tem cor que se reconheca de relance.

     SvnChip.html(url, texto, chaveDoCampo)  -> <a class="svn-chip">...</a>
     SvnChip.rotulo(url)                     -> texto curto, sem UTM
     SvnChip.instagramUrl('@fulano')         -> https://instagram.com/fulano
   ───────────────────────────────────────────────────────────────────────── */
window.SvnChip = (function () {
  // Redes sociais (LinkedIn, Instagram...). Nome era MARCAS e colidia com as
  // marcas SVN de contrato/assinatura, que sao outra coisa.
  var REDES = {
    linkedin: {
      fundo: '#0A66C2',
      svg: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>'
    },
    instagram: {
      fundo: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.3" fill="#fff" stroke="none"/></svg>'
    },
    facebook: {
      fundo: '#1877F2',
      svg: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.2c0-.9.2-1.5 1.5-1.5H17V4.1C16.7 4 15.8 4 14.8 4c-2.1 0-3.6 1.3-3.6 3.7V10H8.5v3h2.7v8h2.3z"/></svg>'
    },
    youtube: {
      fundo: '#FF0000',
      svg: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M21.6 7.2a2.5 2.5 0 00-1.7-1.8C18.3 5 12 5 12 5s-6.3 0-7.9.4A2.5 2.5 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 001.7 1.8C5.7 19 12 19 12 19s6.3 0 7.9-.4a2.5 2.5 0 001.7-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3-5.2 3z"/></svg>'
    }
  };

  /* Arquivos e links genericos: traco 1.5, como os demais icones do Hub. */
  var TRACOS = {
    planilha: '<path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M12 13v4"/>',
    pdf:      '<path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v6h6"/><path d="M8 15h1.5a1.5 1.5 0 000-3H8v6M13 12v6h1.5a1.5 1.5 0 001.5-1.5v-3A1.5 1.5 0 0014.5 12H13z"/>',
    doc:      '<path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    slides:   '<path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v6h6"/><rect x="8" y="12" width="8" height="6" rx="1"/>',
    imagem:   '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-6 6-3-3-4 4"/>',
    arquivo:  '<path d="M21.4 11.05L12.25 20.2a5 5 0 01-7.07-7.07l9.19-9.19a3.33 3.33 0 014.71 4.71l-9.2 9.19a1.67 1.67 0 01-2.35-2.36l8.49-8.48"/>',
    site:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18a15 15 0 010-18z"/>',
    link:     '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>'
  };

  var CHAVES_SOCIAIS = ['linkedin','instagram','facebook','youtube','twitter','x','tiktok','site','website'];

  function esc(s) {
    return (window.esc ? window.esc(s) : String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
  }

  /* Rotulo curto: sem esquema, sem www, sem parametros de rastreio.
     Arquivo com nome tecnico (UUID) vira "Abrir arquivo .ext". */
  function rotulo(url) {
    var s = String(url || '');
    var arq = s.match(/\/([^\/?#]+)\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    if (arq && (/^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(arq[1]) || arq[1].length > 32)) {
      return 'Abrir arquivo .' + arq[2].toLowerCase();
    }
    var limpo = s;
    try {
      var u = new URL(s);
      var lixo = [];
      u.searchParams.forEach(function (_, k) {
        if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) lixo.push(k);
      });
      lixo.forEach(function (k) { u.searchParams.delete(k); });
      limpo = u.host.replace(/^www\./i, '') + u.pathname.replace(/\/+$/, '');
      var resto = u.searchParams.toString();
      if (resto) limpo += '?' + resto;
    } catch (e) {
      limpo = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    }
    return limpo.length > 52 ? limpo.slice(0, 51) + '\u2026' : limpo;
  }

  function instagramUrl(v) {
    var s = String(v || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://instagram.com/' + s.replace(/^@/, '');
  }

  /* Descobre o tipo pelo nome do campo e, se nao der, pela extensao/host. */
  function tipo(url, chave) {
    var k = String(chave || '').toLowerCase();
    for (var i = 0; i < CHAVES_SOCIAIS.length; i++) {
      var s = CHAVES_SOCIAIS[i];
      if (k.indexOf(s) !== -1) return s === 'website' ? 'site' : s;
    }
    var host = (String(url).match(/^https?:\/\/([^\/]+)/i) || [])[1] || '';
    if (/linkedin\./i.test(host))  return 'linkedin';
    if (/instagram\./i.test(host)) return 'instagram';
    if (/facebook\./i.test(host))  return 'facebook';
    if (/youtu\.?be/i.test(host))  return 'youtube';
    var ext = (String(url).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i) || [])[1];
    if (ext) {
      var e = ext.toLowerCase();
      if (['xlsx','xls','csv','ods'].indexOf(e) !== -1)                 return 'planilha';
      if (e === 'pdf')                                                   return 'pdf';
      if (['doc','docx','odt','txt','rtf'].indexOf(e) !== -1)            return 'doc';
      if (['ppt','pptx','odp'].indexOf(e) !== -1)                        return 'slides';
      if (['jpg','jpeg','png','webp','gif','avif','svg'].indexOf(e) !== -1) return 'imagem';
      if (['zip','rar','7z'].indexOf(e) !== -1)                          return 'arquivo';
    }
    return 'link';
  }

  /* Uma linha so: o .dados-value do resumo usa white-space:pre-wrap e
     qualquer indentacao viraria espaco visivel. */
  function html(url, texto, chave) {
    var t = tipo(url, chave);
    var marca = REDES[t];
    var txt = texto || rotulo(url);
    var icone = marca
      ? '<span class="svn-chip__marca" style="background:' + marca.fundo + '">' + marca.svg + '</span>'
      : '<svg class="svn-chip__traco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (TRACOS[t] || TRACOS.link) + '</svg>';
    return '<a class="svn-chip" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(url) + '">' + icone + '<span class="svn-chip__txt">' + esc(txt) + '</span></a>';
  }

  return { html: html, rotulo: rotulo, tipo: tipo, instagramUrl: instagramUrl };
})();

/* statusBadgeHtml — pilula de status. As cores ja vinham do getStatus/getStatusVisual
   do config.js, mas a montagem do <span> estava copiada em tres telas; mudar o
   visual do badge exigia achar as tres. Aceita o id do status ou o objeto ja
   resolvido (util quando a tela usa getStatusVisual, que trata "em alteracao").

     statusBadgeHtml('concluido')
     statusBadgeHtml(getStatusVisual(item), { classe: 'sol-status-badge', id: 'solStatus' })
*/
function statusBadgeHtml(status, opts) {
  var o = opts || {};
  var s = (status && typeof status === 'object')
    ? status
    : (typeof getStatus === 'function' ? getStatus(status) : { label: String(status) });
  var attrId = o.id ? ' id="' + esc(o.id) + '"' : '';
  var extra = o.style ? ';' + o.style : '';
  return '<span class="' + esc(o.classe || 'badge') + '"' + attrId
    + ' style="background:' + (s.bg || '#f1f5f9') + ';color:' + (s.text || '#475569') + extra + '">'
    + esc(s.label) + '</span>';
}
