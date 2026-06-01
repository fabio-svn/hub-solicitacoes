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

  if (key === 'tipoMaterial' || key === 'tipoImpresso') {
    const map = {
      'cracha':'Crachá','crachá':'Crachá','roll-up':'Roll-Up','banner':'Banner',
      'flyer':'Flyer','folder':'Folder','totem':'Totem','adesivo':'Adesivo',
      'cartao':'Cartão','cartaz':'Cartaz','camisa':'Camisa','brinde':'Brinde',
    };
    const lv = String(value).toLowerCase();
    return map[lv] || humanizeSlug(String(value));
  }

  const dataCampos = ['dataEvento', 'prazoEntrega'];
  if (dataCampos.includes(key) && typeof value === 'string') {
    const formatted = formatarData(value);
    if (formatted !== value) return formatted;
  }

  if (key === 'isPrivate' || key === 'private') {
    return (value === 'sim' || value === 'Sim') ? 'Sim' : 'Não';
  }
  if (key === 'modeloCartao') {
    const map = { dourado: 'Dourado', vermelho: 'Vermelho' };
    return map[String(value).toLowerCase()] || humanizeSlug(String(value));
  }
  if (key === 'modeloArte') {
    const map = { 'com-foto': 'Com foto', 'sem-foto': 'Sem foto' };
    return map[String(value)] || humanizeSlug(String(value));
  }
  if (key === 'estado') {
    const ibge = typeof IBGE_ESTADOS !== 'undefined' ? IBGE_ESTADOS : {};
    if (ibge[String(value)]) return ibge[String(value)];
    return String(value);
  }

  const maps = {
    natureza: { presencial:'Presencial', online:'Online', patrocinio:'Patrocínio' },
    maturidade: { 1:'Tenho a maioria das informações', 2:'Tenho algumas informações', 3:'Ainda estou estruturando' },
    localEvento: { unidade:'Unidade SVN', externo:'Local externo', 'nao-definido':'Não definido' },
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
  if (typeof value === 'string' && (value.includes('-') || value.includes('_'))) return humanizeSlug(value);
  return value;
}
