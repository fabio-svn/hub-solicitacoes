/**
 * Convites de Evento — área Corporate.
 * Formulário + prévia renderizada pelo próprio servidor (mesmo motor da arte final).
 * O evento é sempre ONLINE nesta página: o backend fixa tipo_evento e limpa local/endereço.
 */
(function () {
  'use strict';

  var MAX_PALESTRANTES = 4;
  // foto escolhida/enviada por palestrante: { 1: 'https://...', 2: ... }
  var fotos = {};
  var libAlvo = null;      // palestrante que abriu a biblioteca
  var previewSeq = 0;      // descarta respostas de prévias antigas

  // ── coleta dos dados do formulário ──────────────────────────────
  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function coletarDados() {
    var num = parseInt(val('num_palestrantes'), 10) || 1;
    var dados = {
      titulo: val('titulo'),
      data: val('data'),
      horario: val('horario'),
      plataforma: val('plataforma'),
      horario_brasilia: val('horario_brasilia'),
      num_palestrantes: String(num),
    };
    for (var i = 1; i <= num; i++) {
      dados['palestrante_' + i + '_nome'] = val('p' + i + '_nome');
      dados['palestrante_' + i + '_cargo'] = val('p' + i + '_cargo');
      if (fotos[i]) dados['palestrante_' + i + '_foto'] = fotos[i];
    }
    return dados;
  }

  // ── campos dos palestrantes (dinâmico) ──────────────────────────
  function renderPalestrantes() {
    var num = parseInt(val('num_palestrantes'), 10) || 1;
    var cont = document.getElementById('palestrantesContainer');
    var html = '';

    for (var i = 1; i <= num; i++) {
      var foto = fotos[i];
      html +=
        '<div class="cc-palestrante">' +
          '<div class="cc-palestrante-head">' +
            '<span class="cc-palestrante-num">Palestrante ' + i + '</span>' +
          '</div>' +
          '<div class="field">' +
            '<label for="p' + i + '_nome">Nome</label>' +
            '<input type="text" id="p' + i + '_nome" value="' + esc(val('p' + i + '_nome')) + '" placeholder="Nome do palestrante">' +
          '</div>' +
          '<div class="field">' +
            '<label for="p' + i + '_cargo">Cargo</label>' +
            '<input type="text" id="p' + i + '_cargo" value="' + esc(val('p' + i + '_cargo')) + '" placeholder="Ex.: Estrategista-chefe">' +
          '</div>' +
          '<div class="cc-foto-row">' +
            (foto
              ? '<img class="cc-foto-thumb" src="' + esc(foto) + '" alt="Foto do palestrante ' + i + '">'
              : '<div class="cc-foto-placeholder">sem<br>foto</div>') +
            '<div class="cc-foto-actions">' +
              '<button type="button" class="btn btn-secondary" style="padding:6px 12px;font-size:0.78rem" onclick="abrirBiblioteca(' + i + ')">Escolher foto</button>' +
              '<button type="button" class="btn btn-secondary" style="padding:6px 12px;font-size:0.78rem" onclick="document.getElementById(\'fileP' + i + '\').click()">Enviar nova</button>' +
              (foto ? '<button type="button" class="btn btn-secondary" style="padding:6px 12px;font-size:0.78rem" onclick="removerFoto(' + i + ')">Remover</button>' : '') +
              '<input type="file" id="fileP' + i + '" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="enviarFoto(' + i + ', this)">' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    cont.innerHTML = html;
  }

  // ── fotos: upload e biblioteca ──────────────────────────────────
  window.enviarFoto = async function (i, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    showToast('Enviando foto…', 'info');
    var fd = new FormData();
    fd.append('file', file);

    try {
      var res = await fetch('/api/corporate/fotos/upload', { method: 'POST', body: fd });
      var d = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(d.error || 'Falha no upload');
      fotos[i] = d.foto.url;
      renderPalestrantes();
      showToast('Foto enviada.', 'success');
    } catch (e) {
      showToast(e.message || 'Não foi possível enviar a foto.', 'error');
    }
  };

  window.removerFoto = function (i) {
    delete fotos[i];
    renderPalestrantes();
  };

  window.abrirBiblioteca = async function (i) {
    libAlvo = i;
    document.getElementById('libModal').classList.add('visible');
    var box = document.getElementById('libContent');
    box.innerHTML = '<div class="cc-lib-empty">Carregando…</div>';

    try {
      var res = await fetch('/api/corporate/fotos');
      var d = await res.json();
      var lista = d.fotos || [];
      if (lista.length === 0) {
        box.innerHTML = '<div class="cc-lib-empty">Nenhuma foto na biblioteca ainda.<br>Use "Enviar nova" para adicionar a primeira.</div>';
        return;
      }
      box.innerHTML = '<div class="cc-lib-grid">' + lista.map(function (f) {
        return '<div class="cc-lib-item" onclick="escolherFoto(\'' + esc(f.url) + '\')" title="' + esc(f.filename) + '">' +
                 '<img src="' + esc(f.url) + '" alt="' + esc(f.filename) + '" loading="lazy">' +
               '</div>';
      }).join('') + '</div>';
    } catch (e) {
      box.innerHTML = '<div class="cc-lib-empty">Não foi possível carregar a biblioteca.</div>';
    }
  };

  window.escolherFoto = function (url) {
    if (libAlvo) fotos[libAlvo] = url;
    fecharBiblioteca();
    renderPalestrantes();
  };

  window.fecharBiblioteca = function (ev) {
    if (ev && ev.target !== ev.currentTarget) return;
    document.getElementById('libModal').classList.remove('visible');
    libAlvo = null;
  };

  // ── prévia (render real do servidor) ────────────────────────────
  async function atualizarPreview() {
    var dados = coletarDados();
    var box = document.getElementById('previewBox');
    var status = document.getElementById('previewStatus');

    if (!dados.titulo) {
      box.innerHTML = '<div class="cc-preview-empty">Preencha o nome do evento e clique em<br><strong>Atualizar prévia</strong></div>';
      status.textContent = '';
      return;
    }

    var seq = ++previewSeq;
    status.textContent = 'gerando…';

    try {
      var res = await fetch('/api/corporate/convite/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      var d = await res.json().catch(function () { return {}; });
      if (seq !== previewSeq) return;           // chegou fora de ordem: ignora
      if (!res.ok) throw new Error(d.error || 'Falha ao gerar a prévia');

      box.innerHTML = '<img src="' + d.preview + '" alt="Prévia do convite">';
      status.textContent = '';
    } catch (e) {
      if (seq !== previewSeq) return;
      box.innerHTML = '<div class="cc-preview-empty">' + esc(e.message || 'Não foi possível gerar a prévia.') + '</div>';
      status.textContent = '';
    }
  }

  // ── geração final ───────────────────────────────────────────────
  async function gerarConvite() {
    var dados = coletarDados();
    if (!dados.titulo || !dados.data || !dados.horario) {
      showToast('Preencha nome do evento, data e horário.', 'error');
      return;
    }

    var btn = document.getElementById('btnGerar');
    btn.disabled = true;
    btn.textContent = 'Gerando…';

    try {
      var res = await fetch('/api/corporate/convite/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      var d = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(d.error || 'Falha ao gerar o convite');

      var urls = d.urls || {};
      var rotulos = { stories: 'Stories (1080×1920)', feed: 'Feed (1080×1350)', quadrado: 'Quadrado / e-mail' };
      var links = Object.keys(urls).map(function (fmt) {
        return '<a class="cc-link" href="' + esc(urls[fmt]) + '" target="_blank" rel="noopener" download>' +
                 '<span>' + esc(rotulos[fmt] || fmt) + '</span>' +
                 '<small>abrir / baixar</small>' +
               '</a>';
      }).join('');

      document.getElementById('resultLinks').innerHTML = links;
      document.getElementById('resultBox').classList.add('show');
      showToast('Convite gerado!', 'success');
    } catch (e) {
      showToast(e.message || 'Não foi possível gerar o convite.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Gerar convite';
    }
  }

  // ── init ────────────────────────────────────────────────────────
  async function init() {
    await Auth.init();
    if (!Auth.isAuthenticated()) {
      window.location.href = '/auth/login?redirect=/convite-corporate.html';
      return;
    }
    var role = Auth.getUserRole();
    if (role !== 'admin' && role !== 'corporate') {
      window.location.href = '/dashboard.html';
      return;
    }

    if (typeof Shell !== 'undefined' && Shell.render) {
      Shell.render({ activeRoute: 'convite-corporate', contentEl: document.getElementById('pageRoot') });
    }
    document.getElementById('pageRoot').style.display = '';

    renderPalestrantes();

    document.getElementById('num_palestrantes').addEventListener('change', renderPalestrantes);
    document.getElementById('btnPreview').addEventListener('click', atualizarPreview);
    document.getElementById('btnGerar').addEventListener('click', gerarConvite);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
