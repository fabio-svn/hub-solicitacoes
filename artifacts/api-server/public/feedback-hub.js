/* FALE COM O MARKETING (v8) ─────────────────────────────────────────────────
   Canal único de sugestão / elogio / reclamação / problema — sobre o serviço do
   time de marketing E sobre o Hub. São a mesma coisa para quem usa: algo não foi
   bem. Obrigar a pessoa a decidir antes de entrar se o problema é do time ou do
   sistema é atrito, e ela costuma errar. A pergunta "sobre o que é?" resolve
   dentro do formulário.

   ESTILO: usa as convenções globais do style.css — .modal-overlay/.modal-card,
   .field/label/select/textarea, .pill/.pills-wrap, .file-input-*, .alert-card,
   .field-invalid/.field-error, .btn. Antes isto tinha um sistema paralelo de
   classes .svn-fb-*, que divergia do resto do Hub a cada ajuste de tema. O que
   sobrou de .svn-fb-* é só o que não existe globalmente: o FAB em leque, a
   dupla de selects lado a lado e o textarea curto.

   Por que modal e não página: relato de problema perde valor quando a pessoa sai
   da tela onde aconteceu. O contexto técnico vai junto sem ninguém descrever de
   memória — e só quando faz sentido (ver precisaContexto).

   Por que passa pelo POST /api/solicitacoes: assim o relato herda status,
   notificação, histórico e a aparição em "Minhas Solicitações". Canal interno
   morre quando a pessoa reporta e nunca sabe o que aconteceu.

   Sempre identificado. A copy diz isso, porque num sistema autenticado prometer
   anonimato seria mentira. O "quer retorno?" existe para quem quer registrar sem
   entrar numa conversa.

   Carregado pelo shell.js (que já está em todas as páginas autenticadas).
──────────────────────────────────────────────────────────────────────────── */
(function () {
  if (window._svnFeedbackHubCarregado) return;
  window._svnFeedbackHubCarregado = true;

  var TIPO = 'feedback-hub';
  var WHATSAPP_URL = 'https://wa.me/5544991689207';
  var MAX_ANEXO_MB = 10;
  var CHAVE_SETOR = 'svn_feedback_setor';
  var ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';

  /* DICA-DE-ESTREIA: balão que aparece UMA vez por pessoa, ancorado no FAB.
     Interface não ensina novidade — só lembra de algo que a pessoa já sabe que
     existe. Isto cobre o "não sabia que dava", e nada além disso: aparece uma
     vez, some sozinho, e some para sempre assim que a pessoa encosta no botão.
     Para reanunciar o canal um dia (ou anunciar outra coisa), troque a VERSAO:
     a chave antiga deixa de bater e todo mundo vê de novo. */
  var DICA_CHAVE = 'svn_dica_feedback';
  var DICA_VERSAO = 'v1';
  var DICA_ATRASO_MS = 2500;   // deixa a página assentar antes de aparecer
  var DICA_VIDA_MS = 14000;    // some sozinho se ninguém interagir

  var _esc = window.esc || function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* pedeMelhoria: "o que você sugere" não faz sentido em elogio.
     pedeEsperado: só problema pede o comportamento esperado.
     retornoPadrao: quem reclama ou reporta problema normalmente quer resposta;
       quem elogia ou sugere, normalmente não. É só o padrão — dá para trocar. */
  var TIPOS = {
    sugestao: {
      label: 'Sugestão',
      rotulo: 'O que você sugere?',
      placeholder: 'Ex.: poder duplicar uma solicitação anterior em vez de preencher tudo de novo',
      pedeMelhoria: false, pedeEsperado: false, retornoPadrao: false,
    },
    elogio: {
      label: 'Elogio',
      rotulo: 'O que funcionou bem?',
      placeholder: 'Conte o que deu certo e quem participou — elogio nomeado vale mais',
      pedeMelhoria: false, pedeEsperado: false, retornoPadrao: false,
    },
    reclamacao: {
      label: 'Reclamação',
      rotulo: 'O que aconteceu?',
      placeholder: 'Descreva a situação: qual demanda, quando foi e o que você esperava que fosse diferente',
      pedeMelhoria: true, pedeEsperado: false, retornoPadrao: true,
    },
    /* ROTULO-DESAMBIGUADO: era "Problema", e "Problema" e "Reclamação" soam como
       a mesma coisa — quem estava insatisfeito com um prazo hesitava entre os
       dois. "Erro no sistema" nomeia o que de fato separa os dois caminhos:
       reclamação é sobre pessoas e serviço, erro é sobre software quebrado, e
       quem resolve cada um é outra pessoa. O valor gravado segue 'problema',
       para não invalidar os registros já feitos. */
    problema: {
      label: 'Erro no sistema',
      rotulo: 'O que aconteceu?',
      placeholder: 'Ex.: cliquei em Enviar no cartão de visita e a tela ficou parada em "Enviando..."',
      pedeMelhoria: false, pedeEsperado: true, retornoPadrao: true,
    },
  };

  var ASSUNTOS = [
    { id: 'atendimento', label: 'Atendimento e comunicação com o time' },
    { id: 'prazo',       label: 'Prazo de entrega' },
    { id: 'qualidade',   label: 'Qualidade do material entregue' },
    { id: 'hub',         label: 'Hub de Solicitações (o sistema)' },
    { id: 'eventos',     label: 'Eventos' },
    { id: 'outro',       label: 'Outro' },
  ];

  var ICONE_WHATSAPP =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
    '<path d="M11.999 2C6.477 2 2 6.484 2 12.017c0 1.99.521 3.86 1.43 5.484L2 22l4.644-1.414A9.96 9.96 0 0011.999 22C17.523 22 22 17.516 22 11.983 22 6.472 17.523 2 11.999 2zm0 18.15a8.124 8.124 0 01-4.162-1.145l-.299-.178-3.088.941.923-3.121-.196-.32A8.185 8.185 0 013.85 11.983c0-4.51 3.644-8.183 8.15-8.183 4.507 0 8.152 3.672 8.152 8.183 0 4.51-3.645 8.167-8.153 8.167z"/></svg>';

  var ICONE_FEEDBACK =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="15.5" x2="12.01" y2="15.5"/></svg>';

  /* ICONE-SEM-ANEL: o ícone antigo era um "?" DENTRO de um círculo, desenhado
     dentro do círculo do próprio botão — dois anéis concêntricos, e o glifo
     sobrava pequeno no meio. Só o ponto de interrogação, ocupando o botão
     inteiro, lê melhor e resolve o alinhamento: os extremos do traço (topo do
     arco em ~5.6 e o ponto em 18.4) ficam simétricos em torno de y=12. */
  var ICONE_AJUDA =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M8.6 9.1a3.45 3.45 0 1 1 4.75 3.2c-.95.4-1.35 1-1.35 1.9v.65"/>' +
    '<line x1="12" y1="18.4" x2="12.01" y2="18.4"/></svg>';

  var ICONE_FECHAR_FAB =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

  var ICONE_CLIPE =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>';

  // ── Estado ────────────────────────────────────────────────────────────────
  var lequeAberto = false;
  var categoriaAtual = null;   // nada pré-selecionado: ver ESCOLHA-PRIMEIRO
  var assuntoAtual = '';
  var querRetorno = false;
  var arquivoAnexo = null;
  var enviando = false;
  var elFab = null;
  var elOverlay = null;
  var elDica = null;
  var dicaTimer = null;

  // ── Identificação ─────────────────────────────────────────────────────────
  /* NOME-COM-REDE: o Auth.init() é assíncrono e este script carrega com defer,
     então Auth.user pode ainda ser null nos primeiros segundos da página. O
     cache de sessão do próprio auth.js cobre esses casos. Se nem assim vier
     nome, o envio segue sem ele: o servidor usa o da sessão. */
  function obterNome() {
    try {
      if (window.Auth && Auth.user && Auth.user.name) return Auth.user.name;
    } catch (_) {}
    try {
      var cache = JSON.parse(sessionStorage.getItem('svn_auth_cache') || '{}');
      if (cache && cache.user && cache.user.name) return cache.user.name;
    } catch (_) {}
    try {
      var layout = JSON.parse(localStorage.getItem('svn_layout_state') || '{}');
      if (layout && layout.userName) return layout.userName;
    } catch (_) {}
    return '';
  }

  /* SETOR-LEMBRADO: o perfil do Hub não guarda setor (os formulários pedem em
     toda solicitação), então aqui a gente lembra a última escolha da pessoa em
     vez de fazê-la procurar na lista inteira toda vez. */
  function setorLembrado() {
    try { return localStorage.getItem(CHAVE_SETOR) || ''; } catch (_) { return ''; }
  }

  function lembrarSetor(valor) {
    try { if (valor) localStorage.setItem(CHAVE_SETOR, valor); } catch (_) {}
  }

  function listaSetores() {
    if (typeof SETORES === 'undefined' || !Array.isArray(SETORES)) return [];
    return SETORES.filter(function (s) { return s && s !== 'Selecione seu setor'; });
  }

  // ── Contexto técnico ──────────────────────────────────────────────────────
  /* CONTEXTO-CONDICIONAL: URL, navegador e erros de JS ajudam a resolver "o Hub
     travou"; não dizem nada sobre "o prazo estourou". Coletar sempre deixaria o
     formulário com cara de ferramenta de TI para quem quer falar de entrega.

     Nada disso aparece no detalhe da solicitação (os campos são `skip` no
     DRAWER_FIELD_LABELS): para quem relatou é ruído, e viravam badges de link
     sem sentido na tela. Quem investiga lê na descrição da task do ClickUp. */
  /* CHAVE-COM-PREFIXO: o campo se chama fb_assunto, e nao assunto, porque
     "assunto" ja existe no DRAWER_FIELD_LABELS como "Assunto do e-mail" (do
     e-mail marketing). Duas chaves iguais no mesmo objeto: a ultima vence, o
     `skip` era ignorado e o assunto aparecia duas vezes no resumo. */
  function precisaContexto() {
    return assuntoAtual === 'hub' || categoriaAtual === 'problema';
  }

  function coletarContexto() {
    var ctx = {};
    if (!precisaContexto()) return ctx;
    try {
      ctx.ctx_url = String(location.href).slice(0, 400);
      ctx.ctx_pagina = (document.title || location.pathname).slice(0, 160);

      var idSolic = new URLSearchParams(location.search).get('id');
      if (idSolic && /^\d+$/.test(idSolic)) ctx.ctx_solicitacao = idSolic;

      ctx.ctx_navegador = String(navigator.userAgent || '').slice(0, 300);
      ctx.ctx_tela = window.innerWidth + 'x' + window.innerHeight +
        ' (tela ' + (screen.width || '?') + 'x' + (screen.height || '?') + ')';

      var erros = window._svnErrosRecentes;
      if (Array.isArray(erros) && erros.length) {
        ctx.ctx_erros = erros.slice(-3).map(function (e) {
          return '· ' + (e.mensagem || '') + (e.origem ? ' (em ' + e.origem + ')' : '');
        }).join('\n').slice(0, 900);
      }
    } catch (_) { /* contexto é bônus; nunca pode impedir o envio */ }
    return ctx;
  }

  // ── FAB em leque ──────────────────────────────────────────────────────────
  function montarFab() {
    if (document.querySelector('.svn-fab')) return;

    elFab = document.createElement('div');
    elFab.className = 'svn-fab';
    elFab.innerHTML =
      '<div class="svn-fab-acoes" id="svnFabAcoes" aria-hidden="true">' +
        '<a class="svn-fab-acao" id="svnFabWhats" href="' + WHATSAPP_URL + '" target="_blank" rel="noopener">' +
          '<span class="svn-fab-acao-txt">Falar agora no WhatsApp</span>' +
          '<span class="svn-fab-acao-ico is-whats">' + ICONE_WHATSAPP + '</span>' +
        '</a>' +
        '<button type="button" class="svn-fab-acao" id="svnFabFeedback">' +
          '<span class="svn-fab-acao-txt">Fale com o Marketing</span>' +
          '<span class="svn-fab-acao-ico is-feedback">' + ICONE_FEEDBACK + '</span>' +
        '</button>' +
      '</div>' +
      '<button type="button" class="svn-fab-btn" id="svnFabBtn" aria-expanded="false" aria-label="Ajuda e feedback">' +
        '<span class="svn-fab-ico-ajuda">' + ICONE_AJUDA + '</span>' +
        '<span class="svn-fab-ico-fechar">' + ICONE_FECHAR_FAB + '</span>' +
      '</button>';
    document.body.appendChild(elFab);

    document.getElementById('svnFabBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      alternarLeque();
    });
    document.getElementById('svnFabFeedback').addEventListener('click', function () {
      alternarLeque(false);
      abrirModal();
    });
    document.getElementById('svnFabWhats').addEventListener('click', function () {
      alternarLeque(false);
    });

    document.addEventListener('click', function (e) {
      if (lequeAberto && elFab && !elFab.contains(e.target)) alternarLeque(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lequeAberto) alternarLeque(false);
    });
  }

  function alternarLeque(forcar) {
    esconderDica();
    lequeAberto = (typeof forcar === 'boolean') ? forcar : !lequeAberto;
    if (!elFab) return;
    elFab.classList.toggle('is-aberto', lequeAberto);
    var btn = document.getElementById('svnFabBtn');
    var acoes = document.getElementById('svnFabAcoes');
    if (btn) btn.setAttribute('aria-expanded', lequeAberto ? 'true' : 'false');
    if (acoes) acoes.setAttribute('aria-hidden', lequeAberto ? 'false' : 'true');
  }

  // ── Dica de estreia ───────────────────────────────────────────────────────
  function dicaJaVista() {
    // Sem localStorage (navegação privada, storage bloqueado) tratamos como já
    // vista: melhor não mostrar do que mostrar em toda navegação.
    try { return localStorage.getItem(DICA_CHAVE) === DICA_VERSAO; } catch (_) { return true; }
  }

  function marcarDicaVista() {
    try { localStorage.setItem(DICA_CHAVE, DICA_VERSAO); } catch (_) {}
  }

  function agendarDica() {
    if (dicaJaVista()) return;
    setTimeout(function () {
      // Não aparece por cima de quem já está fazendo outra coisa: modal aberto,
      // leque aberto ou aba em segundo plano (aí o balão morreria sem ser visto,
      // e a pessoa perderia o único aviso que ia receber).
      if (dicaJaVista() || elOverlay || lequeAberto || !elFab) return;
      if (document.hidden) return;
      mostrarDica();
    }, DICA_ATRASO_MS);
  }

  function mostrarDica() {
    if (elDica || !elFab) return;
    elDica = document.createElement('div');
    elDica.className = 'svn-fab-dica';
    elDica.setAttribute('role', 'status');
    elDica.innerHTML =
      '<button type="button" class="svn-fab-dica-x" aria-label="Dispensar">&times;</button>' +
      '<strong>Agora tem um canal de feedback</strong>' +
      '<p>Sugestão, elogio, reclamação ou problema no Hub: é por aqui.</p>' +
      '<span class="svn-fab-dica-cta">Quero ver</span>';
    elFab.appendChild(elDica);
    elFab.classList.add('tem-dica');
    requestAnimationFrame(function () { if (elDica) elDica.classList.add('is-visivel'); });

    elDica.addEventListener('click', function (e) {
      var fechou = !!(e.target.closest && e.target.closest('.svn-fab-dica-x'));
      esconderDica();
      if (!fechou) abrirModal();
    });

    dicaTimer = setTimeout(esconderDica, DICA_VIDA_MS);
  }

  // Chamada também quando a pessoa encosta no FAB por conta própria: quem achou
  // sozinho não precisa do aviso na próxima página.
  function esconderDica() {
    marcarDicaVista();
    if (dicaTimer) { clearTimeout(dicaTimer); dicaTimer = null; }
    if (!elDica) return;
    var alvo = elDica;
    alvo.classList.remove('is-visivel');
    setTimeout(function () { if (alvo && alvo.parentNode) alvo.remove(); }, 220);
    elDica = null;
    if (elFab) elFab.classList.remove('tem-dica');
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  function abrirModal(categoria) {
    if (document.querySelector('.svn-fb-overlay')) return;
    esconderDica();
    /* ESCOLHA-PRIMEIRO: o modal abre sem tipo selecionado e sem nenhum campo.
       Com "Sugestão" pré-marcado, quem não prestasse atenção mandava reclamação
       classificada como sugestão — e aí o volume de sugestões diria mais sobre
       o padrão do formulário do que sobre o que as pessoas acham. Só entra com
       tipo definido quem chegou por link (?categoria=) ou pela API interna. */
    categoriaAtual = TIPOS[categoria] ? categoria : null;
    // Quem abre em "problema" quase sempre está falando do sistema; a escolha
    // continua trocável, é só evitar um clique óbvio.
    assuntoAtual = categoriaAtual === 'problema' ? 'hub' : '';
    querRetorno = categoriaAtual ? TIPOS[categoriaAtual].retornoPadrao : false;
    arquivoAnexo = null;
    enviando = false;

    elOverlay = document.createElement('div');
    elOverlay.className = 'modal-overlay svn-fb-overlay';
    elOverlay.innerHTML =
      '<div class="modal-card svn-fb-card" role="dialog" aria-modal="true" aria-labelledby="svnFbTitulo">' +
        '<div class="modal-header">' +
          '<div>' +
            '<h3 class="modal-title" id="svnFbTitulo">Fale com o Marketing</h3>' +
            '<p class="modal-subtitle"> Sua opinião ajuda o marketing a atender melhor cada área da SVN e melhorar as entregas.</p>' +
          '</div>' +
          '<button type="button" class="modal-close" id="svnFbFechar" aria-label="Fechar">&times;</button>' +
        '</div>' +
        '<div class="modal-body" id="svnFbCorpo"></div>' +
      '</div>';
    document.body.appendChild(elOverlay);
    document.body.classList.add('svn-fb-travado');
    // .modal-overlay nasce com opacity 0; a classe .visible é o que dispara a
    // transição e o scaleIn do card, como nas outras telas do Hub.
    requestAnimationFrame(function () { if (elOverlay) elOverlay.classList.add('visible'); });

    document.getElementById('svnFbFechar').addEventListener('click', fecharModal);
    elOverlay.addEventListener('click', function (e) {
      if (e.target === elOverlay && !enviando) fecharModal();
    });
    document.addEventListener('keydown', aoTeclar);

    /* COLAR-ANEXO: sem dica na tela, mas funcionando — quem acabou de tirar um
       print tenta Ctrl+V por instinto, e não custa nada atender. */
    elOverlay.addEventListener('paste', function (e) {
      var itens = (e.clipboardData || {}).items || [];
      for (var i = 0; i < itens.length; i++) {
        if (itens[i].type && itens[i].type.indexOf('image') === 0) {
          var f = itens[i].getAsFile();
          if (f) { definirAnexo(f); e.preventDefault(); }
          return;
        }
      }
    });

    renderarFormulario();
  }

  function aoTeclar(e) {
    if (e.key === 'Escape' && !enviando) fecharModal();
  }

  function fecharModal() {
    document.removeEventListener('keydown', aoTeclar);
    document.body.classList.remove('svn-fb-travado');
    if (elOverlay) {
      var alvo = elOverlay;
      alvo.classList.remove('visible');
      setTimeout(function () { if (alvo && alvo.parentNode) alvo.remove(); }, 240);
    }
    elOverlay = null;
    arquivoAnexo = null;
  }

  // Guarda o que já foi digitado antes de redesenhar (troca de tipo).
  function capturarRascunho() {
    var pega = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    return {
      descricao: pega('svnFbDescricao'),
      esperado: pega('svnFbEsperado'),
      melhoria: pega('svnFbMelhoria'),
      setor: pega('svnFbSetor'),
    };
  }

  function restaurarRascunho(r) {
    if (!r) return;
    var poe = function (id, v) { var el = document.getElementById(id); if (el && v) el.value = v; };
    poe('svnFbDescricao', r.descricao);
    poe('svnFbEsperado', r.esperado);
    poe('svnFbMelhoria', r.melhoria);
    poe('svnFbSetor', r.setor || setorLembrado());
  }

  function campo(id, rotulo, obrigatorio, conteudo, extraClasse) {
    return '<div class="field' + (extraClasse ? ' ' + extraClasse : '') + '" id="campo_' + id + '">' +
      '<label for="' + id + '">' + rotulo + (obrigatorio ? ' <span class="text-ruby">*</span>' : '') + '</label>' +
      conteudo +
      '<div class="field-error" id="erro_' + id + '"></div>' +
    '</div>';
  }

  function renderarFormulario(rascunho) {
    var corpo = document.getElementById('svnFbCorpo');
    if (!corpo) return;

    var pills = Object.keys(TIPOS).map(function (id) {
      return '<button type="button" class="pill' + (id === categoriaAtual ? ' selected' : '') +
        '" data-cat="' + id + '">' + _esc(TIPOS[id].label) + '</button>';
    }).join('');

    var blocoTipo =
      '<div class="field">' +
        '<label>O que você quer registrar? <span class="text-ruby">*</span></label>' +
        '<div class="pills-wrap" id="svnFbTipos">' + pills + '</div>' +
      '</div>';

    // Passo 1: nada escolhido ainda. Nenhum campo, nenhum rodapé — a única coisa
    // a fazer nesta tela é escolher, e é só isso que ela mostra.
    if (!categoriaAtual) {
      corpo.innerHTML =
        '<p class="svn-fb-intro">Este é o espaço para você contar como tem sido a sua experiência com o time de marketing. Use o formulário para registrar uma sugestão de melhoria, elogiar algo que funcionou bem ou relatar um problema no Hub, no atendimento, no prazo ou na entrega de uma demanda. Todos os registros são levados em consideração.</p>' +
        blocoTipo +
        '<p class="svn-fb-vazio">Escolha uma opção acima para continuar.</p>';
      ligarPills(corpo);
      return;
    }

    var t = TIPOS[categoriaAtual];

    var opcoesAssunto = '<option value="">Selecione…</option>' + ASSUNTOS.map(function (a) {
      return '<option value="' + a.id + '"' + (a.id === assuntoAtual ? ' selected' : '') + '>' + _esc(a.label) + '</option>';
    }).join('');

    var setorSalvo = (rascunho && rascunho.setor) || setorLembrado();
    var opcoesSetor = '<option value="">Selecione…</option>' + listaSetores().map(function (s) {
      return '<option value="' + _esc(s) + '"' + (s === setorSalvo ? ' selected' : '') + '>' + _esc(s) + '</option>';
    }).join('');

    corpo.innerHTML =
      blocoTipo +

      '<div class="svn-fb-duo">' +
        campo('svnFbAssunto', 'Assunto', true, '<select id="svnFbAssunto">' + opcoesAssunto + '</select>') +
        campo('svnFbSetor', 'Sua área', false, '<select id="svnFbSetor">' + opcoesSetor + '</select>') +
      '</div>' +

      campo('svnFbDescricao', _esc(t.rotulo), true,
        '<textarea id="svnFbDescricao" class="svn-fb-principal" rows="3" placeholder="' + _esc(t.placeholder) + '"></textarea>') +

      (t.pedeEsperado
        ? campo('svnFbEsperado', 'O que você esperava que acontecesse?', false,
            '<textarea id="svnFbEsperado" class="svn-fb-curto" rows="2" placeholder="Opcional, mas ajuda muito a reproduzir o problema"></textarea>')
        : '') +

      (t.pedeMelhoria
        ? campo('svnFbMelhoria', 'O que você sugere para melhorar?', false,
            '<textarea id="svnFbMelhoria" class="svn-fb-curto" rows="2" placeholder="Se tiver uma ideia de solução, escreva aqui"></textarea>')
        : '') +

      '<div class="field">' +
        '<label>Anexo</label>' +
        '<div class="file-input-wrapper">' +
          '<input type="file" id="svnFbArquivo" accept="' + ACCEPT + '">' +
          '<button type="button" class="file-input-btn" id="svnFbAnexoBtn">' + ICONE_CLIPE + ' Escolher arquivo</button>' +
          '<div class="file-hint">Print, PDF ou documento — até ' + MAX_ANEXO_MB + ' MB</div>' +
          '<div class="file-name" id="svnFbAnexoNome"></div>' +
        '</div>' +
      '</div>' +

      /* RETORNO-COMO-CHECKBOX: eram dois pills iguaizinhos aos do tipo de
         manifestacao, logo abaixo deles — duas fileiras identicas com sentidos
         diferentes, e a opcao preta selecionada tinha o mesmo peso visual de
         "Sugestao". Um checkbox unico diz a mesma coisa sem competir. */
      '<div class="field">' +
        '<label class="checkbox-option svn-fb-check">' +
          '<input type="checkbox" id="svnFbRetorno"' + (querRetorno ? ' checked' : '') + '>' +
          '<span class="checkbox-custom"></span>' +
          '<span>Quero que o time me responda sobre isto</span>' +
        '</label>' +
      '</div>' +

      '<div id="svnFbContexto"></div>' +
      '<div class="alert-card alert-danger" id="svnFbErro" style="display:none"><div class="alert-text"></div></div>' +

      '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" id="svnFbCancelar">Cancelar</button>' +
        '<button type="button" class="btn btn-primary" id="svnFbEnviar">Enviar</button>' +
      '</div>';

    pintarContexto();
    restaurarRascunho(rascunho);

    ligarPills(corpo);

    document.getElementById('svnFbRetorno').addEventListener('change', function (e) {
      querRetorno = e.target.checked;
    });

    document.getElementById('svnFbAssunto').addEventListener('change', function (e) {
      assuntoAtual = e.target.value;
      limparErro('svnFbAssunto');
      pintarContexto();   // liga/desliga o aviso do bloco técnico sem redesenhar
    });

    document.getElementById('svnFbDescricao').addEventListener('input', function () {
      limparErro('svnFbDescricao');
    });

    document.getElementById('svnFbAnexoBtn').addEventListener('click', function () {
      document.getElementById('svnFbArquivo').click();
    });
    document.getElementById('svnFbArquivo').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) definirAnexo(e.target.files[0]);
    });
    document.getElementById('svnFbCancelar').addEventListener('click', fecharModal);
    document.getElementById('svnFbEnviar').addEventListener('click', enviar);

    if (arquivoAnexo) pintarNomeAnexo();
    /* SEM-FOCO-AUTOMATICO: o :focus global pinta a borda de vermelho com halo
       rosa. Focando o textarea na abertura, o modal nascia com o campo
       principal parecendo campo em erro — o padrao visual de "voce errou aqui"
       antes de a pessoa digitar qualquer coisa. */
  }

  function ligarPills(corpo) {
    Array.prototype.forEach.call(corpo.querySelectorAll('#svnFbTipos .pill'), function (b) {
      b.addEventListener('click', function () {
        var r = capturarRascunho();
        var anterior = categoriaAtual;
        categoriaAtual = b.getAttribute('data-cat');
        // Só reaplica o padrão de retorno se a pessoa ainda não tinha mexido.
        if (!anterior || querRetorno === TIPOS[anterior].retornoPadrao) {
          querRetorno = TIPOS[categoriaAtual].retornoPadrao;
        }
        if (categoriaAtual === 'problema' && !assuntoAtual) assuntoAtual = 'hub';
        renderarFormulario(r);
      });
    });
  }

  /* Uma linha, sem enumerar valor nenhum: dizer que dados técnicos vão junto é
     honestidade mínima; listar navegador e resolução na tela de quem relata é
     ruído — a pessoa não tem o que fazer com aquilo. */
  function pintarContexto() {
    var el = document.getElementById('svnFbContexto');
    if (!el) return;
    if (!precisaContexto()) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<div class="alert-card alert-info"><div class="alert-text">' +
      'Para o time conseguir investigar, vamos anexar automaticamente os dados técnicos desta tela.' +
      '</div></div>';
  }

  function definirAnexo(file) {
    if (file.size > MAX_ANEXO_MB * 1024 * 1024) {
      mostrarErro('O arquivo passa de ' + MAX_ANEXO_MB + ' MB. Envie um menor.');
      return;
    }
    arquivoAnexo = file;
    mostrarErro('');
    pintarNomeAnexo();
  }

  function pintarNomeAnexo() {
    var el = document.getElementById('svnFbAnexoNome');
    if (!el) return;
    if (!arquivoAnexo) { el.innerHTML = ''; return; }
    var nome = arquivoAnexo.name || 'imagem colada';
    var kb = Math.round(arquivoAnexo.size / 1024);
    el.innerHTML = '<span class="check">✓</span> ' + _esc(nome) + ' · ' + kb + ' KB' +
      ' <button type="button" class="svn-fb-remover" id="svnFbAnexoRemover" aria-label="Remover anexo">remover</button>';
    document.getElementById('svnFbAnexoRemover').addEventListener('click', function () {
      arquivoAnexo = null;
      var inp = document.getElementById('svnFbArquivo');
      if (inp) inp.value = '';
      pintarNomeAnexo();
    });
  }

  // Validação no padrão do Hub: .field-invalid no campo + texto no .field-error.
  function marcarErro(id, msg) {
    var campoEl = document.getElementById('campo_' + id);
    var erroEl = document.getElementById('erro_' + id);
    if (erroEl) erroEl.textContent = msg;
    if (campoEl) campoEl.classList.add('field-invalid');
    var alvo = document.getElementById(id);
    if (alvo) alvo.focus();
  }

  function limparErro(id) {
    var campoEl = document.getElementById('campo_' + id);
    if (campoEl) campoEl.classList.remove('field-invalid');
  }

  function mostrarErro(msg) {
    var el = document.getElementById('svnFbErro');
    if (!el) return;
    el.querySelector('.alert-text').textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function labelAssunto(id) {
    for (var i = 0; i < ASSUNTOS.length; i++) if (ASSUNTOS[i].id === id) return ASSUNTOS[i].label;
    return '';
  }

  // ── Envio ─────────────────────────────────────────────────────────────────
  async function enviar() {
    if (enviando) return;
    mostrarErro('');

    if (!assuntoAtual) {
      marcarErro('svnFbAssunto', 'Escolha sobre o que é a sua manifestação.');
      return;
    }

    var elDesc = document.getElementById('svnFbDescricao');
    var descricao = (elDesc.value || '').trim();
    if (descricao.length < 10) {
      marcarErro('svnFbDescricao', 'Escreva um pouco mais para o time conseguir agir.');
      return;
    }

    var elEsperado = document.getElementById('svnFbEsperado');
    var elMelhoria = document.getElementById('svnFbMelhoria');
    var elSetor = document.getElementById('svnFbSetor');
    var btn = document.getElementById('svnFbEnviar');
    enviando = true;
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var dados = Object.assign({
      categoria: categoriaAtual,
      categoria_label: TIPOS[categoriaAtual].label,
      fb_assunto: assuntoAtual,
      fb_assunto_label: labelAssunto(assuntoAtual),
      descricao: descricao,
      quer_retorno: querRetorno ? 'sim' : 'nao',
    }, coletarContexto());

    var nome = obterNome();
    if (nome) dados.nome = nome;
    if (elSetor && elSetor.value) { dados.setor = elSetor.value; lembrarSetor(elSetor.value); }
    if (elEsperado && elEsperado.value.trim()) dados.esperado = elEsperado.value.trim();
    if (elMelhoria && elMelhoria.value.trim()) dados.sugestao_melhoria = elMelhoria.value.trim();

    var fd = new FormData();
    fd.append('tipo_solicitacao', TIPO);
    fd.append('dados', JSON.stringify(dados));
    if (arquivoAnexo) fd.append('printFeedback', arquivoAnexo, arquivoAnexo.name || 'anexo.png');

    var ok = false, d = {};
    try {
      var res = await fetch('/api/solicitacoes', { method: 'POST', body: fd, credentials: 'include' });
      d = await res.json().catch(function () { return {}; });
      ok = res.ok;
    } catch (_) {
      d = { error: 'A conexão caiu durante o envio. Tente novamente.' };
    }

    if (!ok) {
      enviando = false;
      btn.disabled = false;
      btn.textContent = 'Enviar';
      mostrarErro((d.error || 'Não foi possível enviar agora.') + (d.ref ? ' (código ' + d.ref + ')' : ''));
      return;
    }

    enviando = false;
    renderarSucesso(d.id);
  }

  function renderarSucesso(id) {
    var corpo = document.getElementById('svnFbCorpo');
    if (!corpo) return;
    var titulo = categoriaAtual === 'elogio' ? 'Obrigado pelo elogio' : 'Registro recebido';
    var texto = querRetorno
      ? 'O time vai te procurar sobre este registro.'
      : 'Ele entrou na fila do time. Você não pediu retorno, então ninguém vai te procurar — mas dá para acompanhar pela sua lista de solicitações.';
    corpo.innerHTML =
      '<div class="svn-fb-ok">' +
        '<div class="svn-fb-ok-ico">' +
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<h4>' + _esc(titulo) + '</h4>' +
        '<p>' + _esc(texto) + '</p>' +
      '</div>' +
      '<div class="modal-footer svn-fb-ok-acoes">' +
        (id ? '<a class="btn btn-secondary" href="/solicitacao.html?id=' + encodeURIComponent(id) + '">Acompanhar</a>' : '') +
        '<button type="button" class="btn btn-primary" id="svnFbOk">Fechar</button>' +
      '</div>';
    document.getElementById('svnFbOk').addEventListener('click', fecharModal);
  }

  // Abertura por link de qualquer lugar (card da home, empty state, atalho).
  window.abrirFeedbackHub = function (categoria) { abrirModal(categoria); };

  /* ABERTURA-POR-URL: a busca do Ctrl+K só sabe navegar para uma URL, então o
     tipo entra no FORM_ROUTES apontando para solicitacoes.html?feedback=1 e a
     abertura acontece aqui. Serve também para qualquer link colado no Teams. */
  function abrirPelaUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('feedback') !== '1') return;
      var cat = q.get('categoria');
      abrirModal(TIPOS[cat] ? cat : null);
      // Limpa o parâmetro para o F5 não reabrir o modal.
      q.delete('feedback'); q.delete('categoria');
      var busca = q.toString();
      history.replaceState(null, '', location.pathname + (busca ? '?' + busca : ''));
    } catch (_) {}
  }

  function iniciar() {
    montarFab();
    abrirPelaUrl();
    agendarDica();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();