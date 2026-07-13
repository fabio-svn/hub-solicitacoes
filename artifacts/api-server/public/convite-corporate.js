/**
 * Convites de Evento — área Corporate.
 * O evento é sempre ONLINE: o backend fixa tipo_evento e limpa local/endereço.
 *
 * Biblioteca de fotos: cada foto é salva com o NOME do palestrante. Quando o
 * mesmo nome é digitado de novo, a foto mais recente daquele nome é carregada
 * automaticamente (e pode ser trocada a qualquer momento).
 */
(function () {
  'use strict';

  var fotos = {};          // { 1: 'https://...' } -> foto escolhida por palestrante
  var fotoAuto = {};       // { 1: true } -> veio do preenchimento automático (pode ser sobrescrita)
  var biblioteca = [];     // [{ id, filename, url, uploaded_at }] ordenada da mais recente p/ a mais antiga
  var libAlvo = null;      // palestrante que abriu o modal
  var previewSeq = 0;      // descarta respostas fora de ordem
  var formatoPreview = 'feed';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  /** '2026-07-24' -> '24 de julho' (formato usado na arte). */
  function formatarData(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var mes = MESES[parseInt(p[1], 10) - 1];
    return mes ? parseInt(p[2], 10) + ' de ' + mes : iso;
  }

  /** '19:00' -> '19h' | '19:30' -> '19h30'. */
  function formatarHorario(hhmm) {
    if (!hhmm) return '';
    var p = hhmm.split(':');
    if (p.length < 2) return hhmm;
    var h = parseInt(p[0], 10);
    return p[1] === '00' ? h + 'h' : h + 'h' + p[1];
  }

  /** normaliza para comparar nomes: sem acento, sem caixa, sem espaços extras */
  function chaveNome(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function coletarDados() {
    var num = parseInt(val('num_palestrantes'), 10) || 1;
    var dados = {
      titulo: val('titulo'),
      data: formatarData(val('data')),
      horario: formatarHorario(val('horario')),
      plataforma: val('plataforma'),
      num_palestrantes: String(num),
    };
    for (var i = 1; i <= num; i++) {
      dados['palestrante_' + i + '_nome'] = val('p' + i + '_nome');
      dados['palestrante_' + i + '_cargo'] = val('p' + i + '_cargo');
      if (fotos[i]) dados['palestrante_' + i + '_foto'] = fotos[i];
    }
    return dados;
  }

  // ── biblioteca de fotos ─────────────────────────────────────────
  async function carregarBiblioteca() {
    try {
      var res = await fetch('/api/corporate/fotos');
      var d = await res.json();
      biblioteca = d.fotos || [];   // já vem da mais recente para a mais antiga
    } catch (e) {
      biblioteca = [];
    }
  }

  /** foto mais recente cadastrada com aquele nome (ou null) */
  function fotoDoNome(nome) {
    var k = chaveNome(nome);
    if (!k) return null;
    for (var i = 0; i < biblioteca.length; i++) {
      if (chaveNome(biblioteca[i].filename) === k) return biblioteca[i].url;
    }
    return null;
  }

  /** ao digitar o nome, puxa a foto já cadastrada — sem sobrescrever escolha manual */
  window.aoMudarNome = function (i) {
    if (fotos[i] && !fotoAuto[i]) return;      // o usuário escolheu na mão: respeita
    var url = fotoDoNome(val('p' + i + '_nome'));
    if (url) {
      fotos[i] = url;
      fotoAuto[i] = true;
    } else if (fotoAuto[i]) {
      delete fotos[i];                          // o nome mudou e não há foto: limpa a automática
      delete fotoAuto[i];
    } else {
      return;
    }
    renderPalestrantes();
  };

  // ── campos dos palestrantes ─────────────────────────────────────
  function renderPalestrantes() {
    var num = parseInt(val('num_palestrantes'), 10) || 1;
    var html = '';

    for (var i = 1; i <= num; i++) {
      var foto = fotos[i];
      html +=
        '<div class="cc-palestrante">' +
          '<span class="cc-palestrante-num">Palestrante ' + i + '</span>' +
          '<div class="field">' +
            '<label for="p' + i + '_nome">Nome</label>' +
            '<input type="text" id="p' + i + '_nome" value="' + esc(val('p' + i + '_nome')) + '" ' +
                   'placeholder="Nome do palestrante" onchange="aoMudarNome(' + i + ')" onblur="aoMudarNome(' + i + ')">' +
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
              '<button type="button" class="btn btn-secondary" style="padding:6px 12px;font-size:0.78rem" onclick="abrirBiblioteca(' + i + ')">' +
                (foto ? 'Trocar foto' : 'Escolher foto') +
              '</button>' +
              (foto ? '<button type="button" class="btn btn-secondary" style="padding:6px 12px;font-size:0.78rem" onclick="removerFoto(' + i + ')">Remover</button>' : '') +
              (fotoAuto[i] ? '<span class="cc-foto-auto">✓ foto do cadastro</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
    }
    document.getElementById('palestrantesContainer').innerHTML = html;
  }

  window.removerFoto = function (i) {
    delete fotos[i];
    delete fotoAuto[i];
    renderPalestrantes();
  };

  // ── modal da biblioteca ─────────────────────────────────────────
  window.abrirBiblioteca = async function (i) {
    libAlvo = i;
    document.getElementById('libModal').classList.add('visible');
    document.getElementById('uploadNome').value = val('p' + i + '_nome');

    var box = document.getElementById('libContent');
    box.innerHTML = '<div class="cc-lib-empty"><span class="cc-spinner"></span></div>';

    await carregarBiblioteca();
    if (biblioteca.length === 0) {
      box.innerHTML = '<div class="cc-lib-empty">Nenhuma foto cadastrada ainda.<br>Envie a primeira abaixo.</div>';
      return;
    }
    box.innerHTML = '<div class="cc-lib-grid">' + biblioteca.map(function (f) {
      return '<div class="cc-lib-item" onclick="escolherFoto(\'' + esc(f.url) + '\')" title="' + esc(f.filename) + '">' +
               '<img src="' + esc(f.url) + '" alt="' + esc(f.filename) + '" loading="lazy">' +
               '<div class="cc-lib-nome">' + esc(f.filename) + '</div>' +
             '</div>';
    }).join('') + '</div>';
  };

  window.escolherFoto = function (url) {
    if (libAlvo) {
      fotos[libAlvo] = url;
      delete fotoAuto[libAlvo];   // escolha manual: não é mais automática
    }
    fecharBiblioteca();
    renderPalestrantes();
  };

  window.fecharBiblioteca = function (ev) {
    if (ev && ev.target !== ev.currentTarget) return;
    document.getElementById('libModal').classList.remove('visible');
    libAlvo = null;
  };

  async function enviarFoto(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    var nome = val('uploadNome');
    if (!nome) {
      showToast('Informe o nome do palestrante antes de enviar a foto.', 'error');
      return;
    }

    var btn = document.getElementById('btnUpload');
    btn.disabled = true;
    btn.innerHTML = '<span class="cc-spinner cc-spinner--sm"></span>Enviando…';

    try {
      var fd = new FormData();
      fd.append('file', file);
      fd.append('nome', nome);

      var res = await fetch('/api/corporate/fotos/upload', { method: 'POST', body: fd });
      var d = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(d.error || 'Falha no upload');

      if (libAlvo) {
        fotos[libAlvo] = d.foto.url;
        delete fotoAuto[libAlvo];
      }
      await carregarBiblioteca();
      fecharBiblioteca();
      renderPalestrantes();
      showToast('Foto de ' + nome + ' salva na biblioteca.', 'success');
    } catch (e) {
      showToast(e.message || 'Não foi possível enviar a foto.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar nova foto';
    }
  }

  // ── prévia ──────────────────────────────────────────────────────
  async function atualizarPreview() {
    var dados = coletarDados();
    dados.formato = formatoPreview;

    var box = document.getElementById('previewBox');
    if (!dados.titulo) {
      box.innerHTML = '<div class="cc-preview-empty">Preencha o nome do evento e clique em<br><strong>Atualizar prévia</strong></div>';
      return;
    }

    var seq = ++previewSeq;
    box.innerHTML = '<div class="cc-loading"><span class="cc-spinner"></span><span>Gerando prévia…</span></div>';

    try {
      var res = await fetch('/api/corporate/convite/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      var d = await res.json().catch(function () { return {}; });
      if (seq !== previewSeq) return;
      if (!res.ok) throw new Error(d.error || 'Falha ao gerar a prévia');

      box.innerHTML = '<img src="' + d.preview + '" alt="Prévia do convite">';
    } catch (e) {
      if (seq !== previewSeq) return;
      box.innerHTML = '<div class="cc-preview-empty">' + esc(e.message || 'Não foi possível gerar a prévia.') + '</div>';
    }
  }

  function trocarFormato(fmt) {
    formatoPreview = fmt;
    var botoes = document.querySelectorAll('#previewFormatos button');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.toggle('active', botoes[i].getAttribute('data-fmt') === fmt);
    }
    if (val('titulo')) atualizarPreview();
  }

  // ── geração ─────────────────────────────────────────────────────
  async function gerarConvite() {
    var dados = coletarDados();
    if (!dados.titulo || !dados.data || !dados.horario) {
      showToast('Preencha nome do evento, data e horário.', 'error');
      return;
    }

    var btn = document.getElementById('btnGerar');
    btn.disabled = true;
    btn.innerHTML = '<span class="cc-spinner cc-spinner--sm"></span>Gerando…';

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
      var html = '';

      ['stories', 'feed', 'quadrado'].forEach(function (fmt) {
        if (!urls[fmt]) return;
        html += '<a class="cc-link" href="' + esc(urls[fmt]) + '" target="_blank" rel="noopener" download>' +
                  '<span>' + esc(rotulos[fmt]) + '</span><small>Abrir / Baixar</small></a>';
      });
      if (urls.zip) {
        html += '<a class="cc-link cc-link--zip" href="' + esc(urls.zip) + '" download>' +
                  '<span>Baixar tudo (.zip)</span><small>3 formatos</small></a>';
      }

      document.getElementById('resultLinks').innerHTML = html;
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
    carregarBiblioteca();   // em segundo plano: habilita o preenchimento automático pelo nome

    document.getElementById('num_palestrantes').addEventListener('change', renderPalestrantes);
    document.getElementById('btnPreview').addEventListener('click', atualizarPreview);
    document.getElementById('btnGerar').addEventListener('click', gerarConvite);
    document.getElementById('btnUpload').addEventListener('click', function () {
      document.getElementById('fileUpload').click();
    });
    document.getElementById('fileUpload').addEventListener('change', function () { enviarFoto(this); });
    document.getElementById('previewFormatos').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-fmt]');
      if (b) trocarFormato(b.getAttribute('data-fmt'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();